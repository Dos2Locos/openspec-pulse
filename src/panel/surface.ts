import { t, setLocale, uiLocale } from '../i18n'
import { githubPreferences } from './delivery'
import { markerWorkspace } from '../board/model'
// OpenSpec Pulse html panel. No build step: Orca transpiles this file and its imports when the
// panel loads. One state object; render() rebuilds the DOM from it.
import { worktreeItemKey } from '../worktree-key'
import { orderingKey, orderingPrefs } from '../ordering'
import { buildPrompt } from '../commands'
import type { AgentAction, AgentTarget, ProfileId } from '../protocol'
import { stateCounts } from '../state'
import { specDetailView } from './relations'
import { detailView } from './detail'
import { h } from './dom'
import { activeLaunch, agentRunInput, type Actions, type PanelState, type ListTab, type Launch } from './model'
import { nextLimit, PAGE_SIZE } from './search'
import { header, listView, refreshAges, tabBar, worktreeSelector } from './views'

// Locale travels as presentation context; it never enters a command or project data.
const request: typeof orca.plugin.request = ((name: string, input?: object) => orca.plugin.request(name, { ...input, locale: orca.locale })) as typeof orca.plugin.request

const AGE_REFRESH_MS = 60_000
const MANIFEST_URL = '/orca-plugin.json'

let state: PanelState = {
  board: !!orca.document,
  browse: null, scope: 'focused', originId: null,
  list: null,
  selected: null,
  detail: null,
  tab: 'active',
  archive: null,
  specs: null,
  archivedFolder: null,
  archivedDetail: null,
  specCapability: null, specDetail: null, history: [], relationQuery: '', relationLimit: PAGE_SIZE,
  ordering: orderingPrefs(null),
  filter: null,
  queries: { active: '', archive: '', specs: '' },
  limits: { active: PAGE_SIZE, archive: PAGE_SIZE, specs: PAGE_SIZE },
  error: null,
  notice: null,
  composer: null,
  pending: null,
  agent: null,
  profile: 'claude-skills',
  model: '',
  target: 'auto',
  draft: '',
  starting: false,
  initializing: false,
  version: null,
  expanded: new Set(),
  folded: new Set()
}
let workspaceId: string | null = null
let restoreGithubFocus = false
let workspaceEpoch = 0
let storeEpoch = 0
let detailGeneration = 0
let previewGeneration = 0
let boardWorkspace: string | null = null
const root = document.getElementById('root') ?? document.body

function update(patch: Partial<PanelState>, redraw = true): void {
  state = { ...state, ...patch }
  if (redraw) render()
}

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error))

/** Runs a worker call; a failure shows under the header instead of breaking the panel. */
async function guarded(work: () => Promise<void>): Promise<void> {
  const epoch = workspaceEpoch
  if (state.error) update({ error: null })
  try {
    await work()
    if (epoch !== workspaceEpoch) return
  } catch (error) {
    if (epoch !== workspaceEpoch) return
    update({ error: message(error) })
  }
}

const selectedKey = (): string | null => (workspaceId ? `selected:${workspaceId}` : null)

const TABS: readonly ListTab[] = ['active', 'archive', 'specs']
// The version leaves room to change what is stored without reading old values wrongly.
const queryKey = (workspace: string, tab: ListTab): string => `query:v1:${workspace}:${tab}`

async function saveQuery(tab: ListTab, query: string): Promise<void> {
  if (!workspaceId) return
  const key = queryKey(workspaceId, tab)
  try {
    await (query ? orca.storage.set(key, query) : orca.storage.delete(key))
  } catch {
    // The search still works; it is just not remembered.
  }
}

async function loadQueries(id: string): Promise<Record<ListTab, string>> {
  const queries: Record<ListTab, string> = { active: '', archive: '', specs: '' }
  for (const tab of TABS) {
    try {
      const stored = await orca.storage.get(queryKey(id, tab))
      if (typeof stored === 'string') queries[tab] = stored
    } catch {
      // Without storage the search starts empty.
    }
  }
  return queries
}

async function saveSelected(name: string | null): Promise<void> {
  const key = selectedKey()
  if (!key) return
  try {
    await (name ? orca.storage.set(key, name) : orca.storage.delete(key))
  } catch (error) {
    update({ error: t("Cannot remember the open change: {p0}", { p0: message(error) }) })
  }
}

async function loadDetail(name: string): Promise<void> {
  const requestedWorkspace = workspaceId
  const generation = ++detailGeneration
  const detail = await request('changes.detail', { name, ...(state.originId || workspaceId ? { workspaceId: state.originId ?? workspaceId! } : {}) })
  if (requestedWorkspace !== workspaceId || generation !== detailGeneration || state.selected !== name) return
  // Archived or deleted while open: back to the list.
  if (!detail) void saveSelected(null)
  update({ detail, selected: detail ? name : null })
}

async function loadArchivedDetail(folder: string): Promise<void> {
  const requestedWorkspace = workspaceId
  const generation = ++detailGeneration
  const archivedDetail = await request('archive.detail', { folder, ...(state.originId || workspaceId ? { workspaceId: state.originId ?? workspaceId! } : {}) })
  if (requestedWorkspace !== workspaceId || generation !== detailGeneration || state.archivedFolder !== folder) return
  // Moved or deleted while open: back to the archive list.
  update({ archivedDetail, archivedFolder: archivedDetail ? folder : null })
}

async function loadSpecDetail(capability: string): Promise<void> {
  const requestedWorkspace = workspaceId
  const generation = ++detailGeneration
  if (!requestedWorkspace) return
  const specDetail = await request('specs.detail', { capability, workspaceId: state.originId ?? requestedWorkspace })
  if (requestedWorkspace !== workspaceId || generation !== detailGeneration || state.specCapability !== capability) return
  update({ specDetail, specCapability: specDetail ? capability : null })
}

async function loadLocation(): Promise<void> {
  if (state.specCapability) await loadSpecDetail(state.specCapability)
  else if (state.archivedFolder) await loadArchivedDetail(state.archivedFolder)
  else if (state.selected) await loadDetail(state.selected)
  else await loadTab()
}

/** Links keep the source detail, list search, pagination and keyboard focus. */
function navigate(location: { selected?: string; archivedFolder?: string; specCapability?: string }): void {
  const focus = document.activeElement instanceof HTMLElement ? document.activeElement.dataset.focus ?? null : null
  const entry = { tab: state.tab, selected: state.selected, archivedFolder: state.archivedFolder,
    specCapability: state.specCapability, relationQuery: state.relationQuery, relationLimit: state.relationLimit, focus }
  previewGeneration++
  update({ preview: null, selected: null, detail: null, archivedFolder: null, archivedDetail: null, specCapability: null, specDetail: null,
    ...location, history: [...state.history, entry], relationQuery: '', relationLimit: PAGE_SIZE, pending: null, composer: null })
  root.querySelector<HTMLElement>('[data-focus="back"]')?.focus()
  void guarded(loadLocation)
}

/** Reads the list of the open tab; the lists of the other tabs are read when their tab opens. */
async function loadTab(): Promise<void> {
  const id = workspaceId
  const tab = state.tab
  if (state.browse) { update({ archive: state.browse.archive, specs: state.browse.specs }); return }
  if (tab === 'archive') {
    const archive = await request('archive.list', {})
    if (id === workspaceId && tab === state.tab) update({ archive })
  } else if (tab === 'specs') {
    const specs = await request('specs.list', {})
    if (id === workspaceId && tab === state.tab) update({ specs })
  }
}

async function loadUsage(generation: number): Promise<void> {
  if (!workspaceId || state.list?.status !== 'ok' || !state.browse) return
  const id = workspaceId, scope = state.scope, epoch = workspaceEpoch
  const ids = state.browse.worktrees.filter(w => scope === 'all' || w.workspaceId === (scope === 'focused' ? id : scope)).map(w => w.workspaceId)
  update({ usageLoading: true, usageError: null })
  const current = () => id === workspaceId && epoch === workspaceEpoch && generation === refreshGeneration && scope === state.scope
  try {
    const usage = await request('usage.get', { workspaceId: id, workspaceIds: ids })
    if (current()) update({ usage, usageLoading: false })
  } catch (error) {
    if (current()) update({ usageLoading: false, usageError: message(error) })
  }
}

let refreshGeneration = 0
function refresh(): Promise<void> {
  const previousLocale = uiLocale()
  document.documentElement.lang = setLocale(orca.locale)
  if (previousLocale !== uiLocale()) state.notice = null
  if (state.board && (!workspaceId || workspaceId !== boardWorkspace)) return Promise.resolve()
  return guarded(async () => {
    const requestedWorkspace = workspaceId
    update({ spendStale: true })
    const generation = ++refreshGeneration
    update({ storesLoading: !!requestedWorkspace, storesError: null })
    const stores = requestedWorkspace ? await request('stores.info', { workspaceId: requestedWorkspace }).catch(error => {
      if (requestedWorkspace === workspaceId && generation === refreshGeneration) update({ storesError: message(error) })
      throw error
    }).finally(() => { if (requestedWorkspace === workspaceId && generation === refreshGeneration) update({ storesLoading: false }) }) : null
    if (requestedWorkspace !== workspaceId || generation !== refreshGeneration) return
    const previousRoot = state.stores?.root?.fingerprint
    const changedRoot = !!state.stores && previousRoot !== stores?.root?.fingerprint
    update({ stores, ...(changedRoot ? { selected: null, detail: null, archivedFolder: null, archivedDetail: null, specCapability: null, specDetail: null,
      preview: null, history: [], pending: null, composer: null, storePreview: null, storeBusy: false, storeDraft: undefined } : {}) }, false)
    if (changedRoot) { storeEpoch++; detailGeneration++; previewGeneration++ }
    const list = await request('changes.list', {}).catch(error => {
      if (requestedWorkspace === workspaceId && generation === refreshGeneration && (changedRoot || state.list?.status !== 'ok')) update({ list: stores?.local ? { status: 'no-openspec', workspace: stores.root?.workspacePath ?? requestedWorkspace! } : null, tab: state.tab === 'stores' ? 'stores' : 'active', selected: null, archivedFolder: null, specCapability: null, history: [], browse: null, archive: null, specs: null, detail: null, archivedDetail: null, specDetail: null })
      if (requestedWorkspace !== workspaceId || generation !== refreshGeneration) return null
      throw error
    })
    if (!list || requestedWorkspace !== workspaceId || generation !== refreshGeneration) return
    // A filter on a state no change has any more is cleared.
    const scope = state.scope ?? 'focused'
    const browse = requestedWorkspace && list.status !== 'remote' && list.status !== 'no-workspace'
      ? await request('worktrees.browse', { focusedWorkspaceId: requestedWorkspace, scope }) : null
    if (requestedWorkspace !== workspaceId || generation !== refreshGeneration || scope !== state.scope) return
    const displayed = browse?.list ?? list
    const changes = displayed.status === 'ok' ? displayed.changes : []
    const filter = state.filter && stateCounts(changes).some((c) => c.state === state.filter) ? state.filter : null
    deliveryRequestKey = ''
    update({ ...(displayed.status !== 'ok' ? { tab: state.tab === 'stores' ? 'stores' as const : 'active' as const, selected: null, detail: null, archivedFolder: null, archivedDetail: null, specCapability: null, specDetail: null, history: [] } : {}), spendStale: false, delivery: {}, browse, list: displayed, archive: browse?.archive ?? null, specs: browse?.specs ?? null, filter })
    if (displayed.status === 'ok') { await loadLocation(); await loadUsage(generation) }
    if (state.preview) await loadPreview(state.preview.file)
    if (activeLaunch(state)) await loadAgent(false)
  })
}

async function onWorkspace(id: string | null): Promise<void> {
  if (state.board && (!boardWorkspace || id !== boardWorkspace)) {
    storeEpoch++
    workspaceEpoch++
    detailGeneration++
    previewGeneration++
    refreshGeneration++
    workspaceId = null
    update({ tab: 'active', storesLoading: false, storesError: null, stores: null, storePreview: null, storeDraft: undefined, storeBusy: false, list: { status: 'no-workspace' }, browse: null, selected: null, detail: null, archivedFolder: null, archivedDetail: null,
      specCapability: null, specDetail: null, preview: null, pending: null, composer: null, agent: null, error: t("This board belongs to another workspace or its marker is invalid. Open board from the current workspace.") })
    return
  }
  const switched = id !== workspaceId
  workspaceId = id
  if (switched) {
    storeEpoch++
    previewGeneration++
    state.preview = null
    restoreGithubFocus = false
    workspaceEpoch++
    detailGeneration++
    deliveryRequestKey = ''
    update({ usage: null, usageError: null, usageLoading: false, usageGroup: 'byModel', usageLimit: 20, spendGroup: "byTask", spendLimit: 20, spendStale: false, storesLoading: false, storesError: null, stores: null, storePreview: null, storeBusy: false, storeDraft: undefined, delivery: {}, deliverySaving: false, githubLoginDraft: null, githubPreferencesOpen: false, browse: null, scope: 'focused', originId: null, list: null, selected: null, detail: null, ordering: orderingPrefs(null), error: null,
      workflowConsent: null, pending: null, composer: null, agent: null, archive: null, specs: null, archivedFolder: null, archivedDetail: null, specCapability: null, specDetail: null, history: [], relationQuery: '', relationLimit: PAGE_SIZE })
    let selected: string | null = null
    const key = selectedKey()
    if (key) {
      try {
        const stored = await orca.storage.get(key)
        selected = typeof stored === 'string' ? stored : null
      } catch {
        // Without storage the list shows; nothing is lost.
      }
    }
    const queries = id ? await loadQueries(id) : { active: '', archive: '', specs: '' }
    let ordering = orderingPrefs(null)
    if (id) {
      await orderingSave
      try { ordering = orderingPrefs(await orca.storage.get(orderingKey(id))) }
      catch { /* Defaults remain usable when storage is unavailable. */ }
    }
    // The workspace changed again while the queries were read: the newer call owns the state.
    if (id !== workspaceId) return
    update(
      { selected, ordering, detail: null, filter: null, queries, limits: { active: PAGE_SIZE, archive: PAGE_SIZE, specs: PAGE_SIZE }, composer: null, pending: null, agent: null, tab: 'active', archive: null, specs: null, archivedFolder: null, archivedDetail: null },
      false
    )
  }
  await refresh()
}

const SESSION = 'session:'

function toTarget(value: string): AgentTarget {
  return value.startsWith(SESSION) ? { terminalId: value.slice(SESSION.length) } : value === 'new' ? 'new' : 'auto'
}

/** A destination that is no longer offered for this profile falls back to automatic. */
function validTarget(target: string, profile: ProfileId): string {
  if (!target.startsWith(SESSION)) return target
  const info = state.agent?.profiles.find((p) => p.id === profile)
  const session = state.agent?.sessions.find((s) => `${SESSION}${s.terminalId}` === target)
  return session && info && session.agent === info.agent && session.available ? target : 'auto'
}

/** Reads the workspace's profiles, saved choice and sessions; `reset` takes the saved choice. */
async function loadAgent(reset: boolean): Promise<void> {
  const requestedWorkspace = workspaceId
  const agent = await request('agent.options', {})
  if (requestedWorkspace !== workspaceId || (agent && agent.workspaceId !== workspaceId)) return
  const sameWorkspace = agent && state.agent?.workspaceId === agent.workspaceId
  if (reset || !sameWorkspace) {
    update({ agent, profile: agent?.prefs.profile ?? 'claude-skills', model: agent?.prefs.model ?? '', target: 'auto' })
  } else {
    update({ agent })
    update({ target: validTarget(state.target, state.profile) })
  }
}

async function savePrefs(): Promise<void> {
  const workspace = state.agent?.workspaceId
  if (!workspace) return
  try {
    await request('agent.prefs.set', { workspaceId: workspace, prefs: { profile: state.profile, model: state.model.trim() || null } })
  } catch (error) {
    update({ error: t("Cannot remember the agent choice: {p0}", { p0: message(error) }) })
  }
}

function restoreLaunchFocus(launch: Launch): void {
  if (launch.workspaceId !== workspaceId) return
  const key = launch.task
    ? `run:${launch.workspaceId ?? ''}:${launch.change}:${launch.task.section}:${launch.task.position}`
    : `run:${launch.action}:${launch.change}`
  const listKey = `run:${launch.action}:${worktreeItemKey(launch.workspaceId ?? '', 'active', launch.change ?? '')}`
  const target = [...root.querySelectorAll<HTMLElement>('[data-focus]')].find((el) => el.dataset.focus === key || el.dataset.focus === listKey)
  const control = target ?? root.querySelector<HTMLElement>('[data-focus="back"]')
  control?.focus()
}

async function run(launch: Launch, input: { prompt?: string }): Promise<boolean> {
  const agent = state.agent
  const info = agent?.profiles.find((p) => p.id === state.profile)
  if (!agent || !info || (launch.workspaceId && launch.workspaceId !== agent.workspaceId)) return false
  update({ starting: true, notice: null })
  try {
    const sessionTarget = state.target.startsWith(SESSION)
    const answer = await request('agent.run', agentRunInput(launch, {
      ...input,
      ...(agent.workflow ? { workflowFingerprint: agent.workflow.fingerprint } : {}),
      ...(state.workflowConsent ? { approval: state.workflowConsent } : {}),
      // What the sheet showed: the host refuses it if the workspace or the session changed since.
      workspaceId: launch.workspaceId ?? agent.workspaceId,
      profile: state.profile,
      model: info.supportsModel && !sessionTarget ? state.model.trim() || null : null,
      target: toTarget(state.target)
    }))
    const what = launch.task ? t('Task {p0}.{p1} of {p2}', { p0: launch.task.section + 1, p1: launch.task.position + 1, p2: launch.change ?? '' }) : launch.change ? `${({continue:t('Continue'),apply:t('Apply'),verify:t('Verify'),archive:t('Archive'),task:t('Run task'),explore:t('Explore'),propose:t('New proposal')})[launch.action]} ${launch.change}` : launch.action === 'propose' ? t('New proposal') : t('Explore')
    const name = answer.agent === 'codex' ? 'Codex' : 'Claude Code'
    const where = answer.surface === 'open-terminal' ? t("Sent to the open {p0} terminal", { p0: name }) : t("{p0} started in a new {p1}", { p0: name, p1: answer.surface === 'chat' ? t('chat') : t('terminal') })
    update({ notice: { tone: 'success', text: `${where}: ${what}.` } })
    return true
  } catch (error) {
    update({ notice: { tone: 'error', text: message(error) } })
    if (launch.task) {
      update({ pending: null })
      await refresh()
    }
    // The sessions may be why it failed: show the current ones.
    void loadAgent(false).catch(() => undefined)
    return false
  } finally {
    update({ starting: false })
    if (launch.task && !state.pending) restoreLaunchFocus(launch)
  }
}

// Serialize writes so rapid toggles cannot persist an older snapshot last.
let orderingSave: Promise<void> = Promise.resolve()
function saveOrdering(): void {
  const id = workspaceId
  const prefs = state.ordering
  if (!id) return
  orderingSave = orderingSave.then(async () => {
    try {
      const stored = await orca.storage.get(orderingKey(id))
      const unknown = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {}
      await orca.storage.set(orderingKey(id), { ...unknown, ...prefs })
    } catch (error) {
      if (id === workspaceId) update({ error: t("Cannot remember ordering: {p0}", { p0: message(error) }) })
    }
  })
}

const actions: Actions = {
  setUsageGroup: group => {
    update({ usageGroup: group, usageLimit: 20 })
    requestAnimationFrame(() => root.querySelector<HTMLElement>('[data-focus="usage-group"]')?.focus())
  },
  moreUsage: () => update({ usageLimit: (state.usageLimit ?? 20) + 20 }),
  setSpendGroup: group => {
    update({ spendGroup: group, spendLimit: 20 })
    requestAnimationFrame(() => root.querySelector<HTMLElement>('[data-focus="spend-group"]')?.focus())
  },
  moreSpend: () => update({ spendLimit: (state.spendLimit ?? 20) + 20 }),
  setStoreDraft: (field, value) => update({ storeDraft: { id: '', path: '', prefixes: state.stores?.root?.prefixes.join(', ') ?? '', ...state.storeDraft, [field]: value } }),
  previewStore: operation => {
    const id = workspaceId, epoch = storeEpoch
    if (!id || state.storeBusy) return
    update({ storeBusy: true })
    void guarded(async () => {
      const storePreview = await request('stores.preview', { workspaceId: id, operation })
      if (epoch !== storeEpoch) return
      update({ storePreview })
      root.querySelector<HTMLElement>('[data-focus="store-preview-heading"]')?.focus()
    }).finally(() => { if (epoch === storeEpoch) update({ storeBusy: false }) })
  },
  cancelStore: () => {
    if (state.storeBusy) return
    update({ storePreview: null })
    root.querySelector<HTMLElement>('[data-focus="store-selection"]')?.focus()
  },
  commitStore: () => {
    const id = workspaceId, preview = state.storePreview, epoch = storeEpoch
    if (!id || !preview || state.storeBusy) return
    update({ storeBusy: true })
    void guarded(async () => {
      await request('stores.commit', { workspaceId: id, token: preview.token })
      if (epoch !== storeEpoch) return
      update({ storePreview: null, storeDraft: undefined, notice: { tone: 'success', text: t("Store operation saved.") } })
      await refresh()
    }).finally(() => { if (epoch === storeEpoch) {
      update({ storeBusy: false, storePreview: null })
      root.querySelector<HTMLElement>('[data-focus="store-selection"]')?.focus()
    } })
  },
  saveStoreScope: () => {
    const id = workspaceId, data = state.stores?.root, epoch = storeEpoch
    if (!id || !data || state.storeBusy) return
    const text = state.storeDraft?.prefixes ?? data.prefixes.join(', ')
    update({ storeBusy: true })
    void guarded(async () => {
      await request('stores.scope.set', { workspaceId: id, fingerprint: data.fingerprint, prefixes: text.split(',').map(p => p.trim()).filter(Boolean) })
      if (epoch === storeEpoch) await refresh()
    }).finally(() => { if (epoch === storeEpoch) { update({ storeBusy: false }); root.querySelector<HTMLElement>('[data-focus="store-prefixes"]')?.focus() } })
  },
  openBoard: () => { if (workspaceId) void guarded(async () => { await request('board.open', { workspaceId: workspaceId! }) }) },
  previewFile: file => { void guarded(() => loadPreview(file, true)) },
  closePreview: () => {
    const file = state.preview?.file
    previewGeneration++
    update({ preview: null })
    ;[...root.querySelectorAll<HTMLElement>('[data-focus]')].find(el => el.dataset.focus === `preview:${file}`)?.focus()
  },
  setGithubPreferencesOpen: open => update({ githubPreferencesOpen: open }, false),
  setGithubLoginDraft: login => update({ githubLoginDraft: login }, false),
  saveGithubLogin: login => {
    const id = workspaceId
    const snapshot = id ? state.delivery?.[id] : null
    if (!id || !snapshot || state.deliverySaving) return
    const epoch = workspaceEpoch
    update({ deliverySaving: true })
    void guarded(async () => {
      await request('delivery.login.set', { workspaceId: id, project: snapshot.project, login })
      if (epoch !== workspaceEpoch) return
      update({ delivery: {}, githubLoginDraft: null })
      await refresh()
    }).finally(() => { if (epoch === workspaceEpoch) {
      restoreGithubFocus = true
      update({ deliverySaving: false })
      const button = root.querySelector<HTMLElement>('[data-focus="github-save"]')
      if (button) { button.focus(); restoreGithubFocus = false }
    } })
  },
  acceptWorkflow: (fingerprint, command, accepted) => update({ workflowConsent: accepted ? { fingerprint, command } : null }),
  setScope: scope => {
    previewGeneration++
    state.preview = null
    workspaceEpoch++
    detailGeneration++
    refreshGeneration++
    deliveryRequestKey = ''
    update({ usage: null, usageError: null, usageLoading: false, delivery: {}, scope, originId: null, list: null, selected: null, detail: null, archivedFolder: null, archivedDetail: null,
      specCapability: null, specDetail: null, archive: null, specs: null, history: [], pending: null, composer: null, error: null,
      filter: null, limits: { active: PAGE_SIZE, archive: PAGE_SIZE, specs: PAGE_SIZE } })
    void refresh()
  },
  back: () => {
    previewGeneration++
    state.preview = null
    const entry = state.history.at(-1)
    if (!entry) { actions.select(null); actions.openArchived(null); return }
    const { focus, ...location } = entry
    const id = workspaceId
    update({ ...location, originId: entry.selected || entry.archivedFolder || entry.specCapability ? state.originId : null, history: state.history.slice(0, -1), detail: null, archivedDetail: null, specDetail: null, pending: null, composer: null })
    void guarded(async () => {
      await loadLocation()
      if (id !== workspaceId) return
      const control = [...root.querySelectorAll<HTMLElement>('[data-focus]')].find(el => el.dataset.focus === focus)
      const target = control ?? root.querySelector<HTMLElement>('[data-focus="back"], .search-input')
      target?.focus()
    })
  },
  showSpec: (capability, originId) => { if (originId) update({ originId }, false); navigate({ specCapability: capability }) },
  showRelated: change => navigate(change.source === 'archive' ? { archivedFolder: change.folder } : { selected: change.name }),
  setRelationQuery: relationQuery => update({ relationQuery, relationLimit: PAGE_SIZE }),
  moreRelations: () => update({ relationLimit: nextLimit(state.relationLimit) }),
  setOrdering: (mode) => {
    update({ ordering: { ...state.ordering, mode }, limits: { ...state.limits, active: PAGE_SIZE } })
    saveOrdering()
  },
  toggleFavorite: (name) => {
    if (state.list?.status !== 'ok' || !state.list.changes.some(c => c.name === name)) return
    const favorites = new Set(state.ordering.favorites)
    if (!favorites.delete(name)) favorites.add(name)
    update({ ordering: { ...state.ordering, favorites: [...favorites] } })
    saveOrdering()
  },
  refresh: () => void refresh(),
  select: (name, originId) => {
    if (state.board && name) {
      update({ originId: originId ?? workspaceId }, false)
      navigate({ selected: name })
      return
    }
    previewGeneration++
    state.preview = null
    update({ originId: name ? originId ?? state.originId ?? workspaceId : null }, false)
    detailGeneration++
    update({ selected: name, detail: null, pending: null, composer: null, history: [], relationQuery: '', relationLimit: PAGE_SIZE })
    if (!state.originId || state.originId === workspaceId) void saveSelected(name)
    if (name) void guarded(() => loadDetail(name))
  },
  setTab: (tab) => {
    update({ tab, history: [], selected: null, detail: null, archivedFolder: null, archivedDetail: null, specCapability: null, specDetail: null, originId: null })
    void guarded(loadTab)
  },
  openArchived: (folder, originId) => {
    if (state.board && folder) {
      update({ originId: originId ?? workspaceId }, false)
      navigate({ archivedFolder: folder })
      return
    }
    previewGeneration++
    state.preview = null
    update({ originId: folder ? originId ?? state.originId ?? workspaceId : null }, false)
    detailGeneration++
    update({ archivedFolder: folder, archivedDetail: null, pending: null, composer: null, history: [], relationQuery: '', relationLimit: PAGE_SIZE })
    if (folder) void guarded(() => loadArchivedDetail(folder))
  },
  openArchivedFile: (name, file) =>
    void guarded(async () => void (await request('changes.open', { name, file, archived: true, ...(state.originId || workspaceId ? { workspaceId: state.originId ?? workspaceId! } : {}) }))),
  openSpec: (capability) => void guarded(async () => void (await request('specs.open', { capability, ...(state.originId || workspaceId ? { workspaceId: state.originId ?? workspaceId! } : {}) }))),
  setFilter: (filter) => update({ filter, limits: { ...state.limits, active: PAGE_SIZE } }),
  setQuery: (tab, query) => {
    update({ queries: { ...state.queries, [tab]: query }, limits: { ...state.limits, [tab]: PAGE_SIZE } })
    void saveQuery(tab, query)
  },
  loadMore: (tab) => update({ limits: { ...state.limits, [tab]: nextLimit(state.limits[tab]) } }),
  openFile: (name, file) => void guarded(async () => void (await request('changes.open', { name, ...(file ? { file } : {}), ...(state.originId || workspaceId ? { workspaceId: state.originId ?? workspaceId! } : {}) }))),
  // Never sends at once: the sheet shows agent, destination and command first.
  run: (action, change) => {
    if (state.list?.status === 'ok' && state.list.root?.kind === 'store') return
    if (state.originId && state.originId !== workspaceId) return
    update({ workflowConsent: null, pending: { action, change, workspaceId: workspaceId ?? undefined }, composer: null, draft: '', notice: null })
    root.querySelector<HTMLElement>('[data-focus="launch-heading"]')?.focus()
    void guarded(() => loadAgent(true))
  },
  runTask: (change, task, workspaceId) => {
    if (state.list?.status === 'ok' && state.list.root?.kind === 'store') return
    if (state.starting || (workspaceId !== state.browse?.focusedWorkspaceId && state.browse)) return
    update({ workflowConsent: null, pending: { action: 'task', change, task, workspaceId }, composer: null, draft: '', notice: null })
    root.querySelector<HTMLElement>('[data-focus="launch-heading"]')?.focus()
    void guarded(() => loadAgent(true))
  },
  initialize: () => {
    if (state.scope !== 'focused') return
    update({ initializing: true })
    void guarded(async () => update({ list: await request('openspec.init', { workspaceId: workspaceId! }) })).finally(() =>
      update({ initializing: false })
    )
  },
  // The form lives in the Active list: show that first.
  openComposer: (composer) => {
    if (state.scope !== 'focused' || (state.list?.status === 'ok' && state.list.root?.kind === 'store')) return
    update({ workflowConsent: null, composer, pending: null, draft: '', notice: null, tab: 'active', selected: null, detail: null, archivedFolder: null, archivedDetail: null, specCapability: null, specDetail: null, history: [] })
    void guarded(() => loadAgent(true))
  },
  closeComposer: () => {
    if (state.starting) return
    const launch = state.pending
    update({ composer: null, pending: null })
    if (launch) restoreLaunchFocus(launch)
  },
  setProfile: (profile) => {
    const info = state.agent?.profiles.find((p) => p.id === profile)
    update({ workflowConsent: null, profile, model: info?.supportsModel ? state.model : '', target: validTarget(state.target, profile) })
    void savePrefs()
  },
  setModel: (model) => {
    update({ model }, false)
    void savePrefs()
  },
  setTarget: (target) => update({ target }),
  // No redraw while typing: the textarea already shows it. Only the Start button follows.
  setDraft: (draft) => {
    if (state.agent?.workflow?.config?.commands?.[state.composer ?? 'explore']) {
      update({ draft, workflowConsent: null })
      const textarea = root.querySelector<HTMLTextAreaElement>('#composer-text')
      textarea?.focus()
      return
    }
    update({ draft }, false)
    // The textarea is not redrawn, so the command preview is updated in place.
    const launch = activeLaunch(state)
    const code = root.querySelector('.composer .preview code')
    if (launch && code) {
      const built = buildPrompt(state.profile, launch.action, { change: launch.change, prompt: draft })
      code.textContent = 'prompt' in built ? built.prompt : t("Describe the change to propose.")
    }
    const start = root.querySelector<HTMLButtonElement>('.composer .primary')
    if (start) start.disabled = state.starting || !state.agent || (state.composer === 'propose' && draft.trim() === '')
  },
  submit: () => {
    const launch = activeLaunch(state)
    if (!launch || state.starting || (launch.action === 'propose' && !state.draft.trim())) return
    const free = state.composer !== null
    void run(launch, free ? { prompt: state.draft } : {}).then((ok) => {
      if (ok) actions.closeComposer()
    })
  },
  toggleExpanded: (key) => {
    const expanded = new Set(state.expanded)
    if (!expanded.delete(key)) expanded.add(key)
    update({ expanded })
  },
  setFolded: (key, folded) => {
    const next = new Set(state.folded)
    next.delete(key)
    next.delete(`${key}:open`)
    next.add(folded ? key : `${key}:open`)
    update({ folded: next })
  }
}

let deliveryRequestKey = ''
let deliveryTimer: ReturnType<typeof setTimeout> | undefined
function scheduleDelivery(): void {
  if (!workspaceId || state.list?.status !== 'ok' || !state.browse) return
  const groups = new Map<string, Set<string>>([[workspaceId, new Set()]])
  for (const card of root.querySelectorAll<HTMLElement>('[data-delivery-change][data-delivery-workspace]')) {
    const id = card.dataset.deliveryWorkspace!, name = card.dataset.deliveryChange!
    const names = groups.get(id) ?? new Set<string>()
    names.add(name); groups.set(id, names)
  }
  const key = JSON.stringify([workspaceEpoch, refreshGeneration, [...groups].map(([id, names]) => [id, [...names]])])
  if (key === deliveryRequestKey) return
  clearTimeout(deliveryTimer)
  deliveryRequestKey = key
  const epoch = workspaceEpoch
  deliveryTimer = setTimeout(() => void guarded(async () => {
    for (const [id, names] of groups) {
      const all = [...names]
      for (let i = 0; i < Math.max(1, all.length); i += 6) {
        if (key !== deliveryRequestKey || epoch !== workspaceEpoch) return
        const snapshot = await request('delivery.get', { workspaceId: id, names: all.slice(i, i + 6) })
        if (key !== deliveryRequestKey || epoch !== workspaceEpoch) return
        const previous = state.delivery?.[id]
        update({ delivery: { ...state.delivery, [id]: { ...snapshot, changes: { ...previous?.changes, ...snapshot.changes } } } })
        if (restoreGithubFocus && id === workspaceId) {
          root.querySelector<HTMLElement>('[data-focus="github-save"]')?.focus()
          restoreGithubFocus = false
        }
      }
    }
  }), 0)
}

const FOCUSABLE = 'a, button, summary, textarea, select, input, [tabindex]'
/** What identifies a control across redraws: its data-focus, else its tag and name. */
const focusKey = (el: Element): string =>
  (el as HTMLElement).dataset?.focus ?? `${el.tagName}:${el.getAttribute('aria-label') ?? el.textContent}`

/** Rebuilds the panel, keeping focus (and the caret) on the control that had it. */
function render(): void {
  const active = document.activeElement
  const key = active && active !== document.body && root.contains(active) ? focusKey(active) : null
  const caret = active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement ? [active.selectionStart, active.selectionEnd] : null
  const notice = state.notice
  const tabs = state.selected || state.archivedFolder || state.specCapability ? null : tabBar(state, actions)
  const origin = state.browse?.worktrees.find(w => w.workspaceId === state.originId)
  const detailState = { ...state, readOnly: !!state.detail?.readOnly || !!state.archivedDetail?.readOnly || (!!state.originId && state.originId !== workspaceId) }
  const githubPrefs = githubPreferences(state, actions)
  root.replaceChildren(
    header(state, actions),
    worktreeSelector(state, actions),
    ...(githubPrefs ? [githubPrefs] : []),
    // Tabs belong to the lists; a detail has its own back button.
    ...(tabs ? [tabs] : []),
    h('main', { class: 'body' }, [
      state.list?.status === 'ok' && state.list.workflow?.error ? h('p', { class: 'message error', role: 'status' }, [state.list.workflow.error, t(" Using defaults.")]) : null,
      state.error ? h('p', { class: 'message error', role: 'alert' }, [state.error]) : null,
      notice ? h('p', { class: `message ${notice.tone === 'error' ? 'error' : 'muted'}`, role: 'status' }, [notice.text]) : null,
      ...(origin && (state.selected || state.archivedFolder || state.specCapability) ? [h('p', { class: 'worktree-origin' }, [`${origin.name} · ${origin.branch ?? t("Detached / unknown branch")}${detailState.readOnly ? t(" · Read only") : ''}`])] : []),
      ...(state.specCapability ? specDetailView(detailState, actions) : state.selected || state.archivedFolder ? detailView(detailState, actions) : listView(state, actions))
    ])
  )
  scheduleDelivery()
  if (!key) return
  let target = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].find((el) => focusKey(el) === key)
  // The last batch removes Load more; keep keyboard navigation at its first new row.
  if (!target && key?.startsWith('more:') && TABS.includes(key.slice(5) as ListTab)) {
    const tab = key.slice(5) as ListTab
    const container = state.board && tab === 'archive' ? '.board-archive ' : ''
    const row = root.querySelector<HTMLElement>(`${container}.body-list > :nth-child(${state.limits[tab] - PAGE_SIZE + 1})`)
    target = row?.matches(FOCUSABLE) ? row : row?.querySelector<HTMLElement>(FOCUSABLE) ?? undefined
    if (!target && state.board && tab === 'active') target = root.querySelector<HTMLElement>('.board-columns .card-name') ?? undefined
  }
  if (!target && key === 'more:relations') {
    target = root.querySelector<HTMLElement>(`.relations .body-list > :nth-child(${state.relationLimit - PAGE_SIZE + 1})`) ?? undefined
  }
  if (!target && key === `clear:${state.tab}`) {
    target = root.querySelector<HTMLElement>('.search-input') ?? undefined
  }
  if (!target && key === 'spend-more') target = root.querySelector<HTMLElement>('[data-focus="spend-group"]') ?? undefined
  if (!target && key === 'usage-more') target = root.querySelector<HTMLElement>('[data-focus="usage-group"]') ?? undefined
  target?.focus()
  if (caret && caret[0] !== null && (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement)) target.setSelectionRange(caret[0], caret[1])
}

async function readVersion(): Promise<void> {
  try {
    const response = await fetch(MANIFEST_URL)
    const manifest: unknown = await response.json()
    const version = (manifest as { version?: unknown })?.version
    if (typeof version === 'string') update({ version })
  } catch {
    // The header shows the name alone.
  }
}

async function loadPreview(file: string, focus = false): Promise<void> {
  const id = state.originId ?? workspaceId
  const name = state.archivedFolder ?? state.selected
  if (!id || !name) return
  const archived = !!state.archivedFolder
  const epoch = workspaceEpoch
  const generation = ++previewGeneration
  update({ preview: { file, markdown: null, error: null } })
  if (focus) root.querySelector<HTMLElement>('[data-focus="preview-heading"]')?.focus()
  try {
    const result = await request('artifacts.read', { workspaceId: id, name, file, ...(archived ? { archived: true as const } : {}) })
    if (epoch !== workspaceEpoch || generation !== previewGeneration) return
    update({ preview: { file, markdown: result?.markdown ?? null, error: result ? null : t("Artifact unavailable. Refresh or open another artifact.") } })
  } catch (error) {
    if (epoch === workspaceEpoch && generation === previewGeneration) update({ preview: { file, markdown: null, error: message(error) } })
  }
}

async function start(): Promise<void> {
  document.documentElement.lang = setLocale(orca.locale)
  const link = h('link', { rel: 'stylesheet', href: new URL('./panel.css', import.meta.url).href })
  document.head.append(link)
  if (state.board) {
    document.body.classList.add('pulse-board')
    document.head.append(h('link', { rel: 'stylesheet', href: new URL('../board/board.css', import.meta.url).href }))
    const doc = await orca.document!.get()
    boardWorkspace = doc.content.kind === 'text' ? markerWorkspace(doc.content.text) : null
    orca.document!.onDidChange(next => {
      const id = next.content.kind === 'text' ? markerWorkspace(next.content.text) : null
      if (id !== boardWorkspace) { boardWorkspace = null; void onWorkspace(null) }
    })
  }
  render()
  // workspace.changed fires once on subscribe, which does the first load.
  orca.on('workspace.changed', ({ context }) => void onWorkspace(context?.workspaceId ?? null))
  orca.plugin.on('changes.changed', () => void refresh())
  orca.storage.onDidChange(change => {
    const id = workspaceId
    if (!id || change.key !== orderingKey(id)) return
    void guarded(async () => { const value = await orca.storage.get(orderingKey(id)); if (id === workspaceId) update({ ordering: orderingPrefs(value) }) })
  })
  root.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return
    if (state.storePreview) actions.cancelStore()
    else if (state.pending || state.composer) actions.closeComposer()
    else if (state.preview) actions.closePreview()
    else if (state.selected || state.archivedFolder || state.specCapability) actions.back()
    else return
    event.preventDefault()
    event.stopPropagation()
  })
  // A session that finishes or starts asking changes what the open sheet may offer.
  orca.on('agent.status.changed', () => {
    if (activeLaunch(state)) void loadAgent(false).catch(() => undefined)
  })
  // Editors do not replay workspace.changed on subscription. Read the initial context too;
  // an event that arrives meanwhile owns the newer state.
  const epoch = workspaceEpoch
  const context = await orca.host.call('workspace.readContext', {})
  if (epoch === workspaceEpoch) await onWorkspace(context?.workspaceId ?? null)
  // The --orca-* variables and the html class change on their own; nothing to redraw.
  setInterval(() => { refreshAges(root); deliveryRequestKey = ''; scheduleDelivery(); if (state.list?.status === 'ok') void refresh() }, AGE_REFRESH_MS)
  void readVersion()
}

export const surfaceReady = start().catch(error => {
  root.replaceChildren(h('p', { class: 'message error', role: 'alert' }, [t("Cannot open OpenSpec Pulse: {p0}", { p0: message(error) })]))
})
