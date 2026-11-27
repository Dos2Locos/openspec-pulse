// OpenSpec Pulse html panel. No build step: Orca transpiles this file and its imports when the
// panel loads. One state object; render() rebuilds the DOM from it.
import { buildPrompt } from '../commands'
import type { AgentAction, AgentTarget, ProfileId } from '../protocol'
import { stateCounts } from '../state'
import { detailView } from './detail'
import { h } from './dom'
import { activeLaunch, type Actions, type PanelState, type Tab } from './model'
import { nextLimit, PAGE_SIZE } from './search'
import { header, listView, refreshAges, tabBar } from './views'

const AGE_REFRESH_MS = 60_000
const MANIFEST_URL = '/orca-plugin.json'

let state: PanelState = {
  list: null,
  selected: null,
  detail: null,
  tab: 'active',
  archive: null,
  specs: null,
  archivedFolder: null,
  archivedDetail: null,
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
const root = document.getElementById('root') ?? document.body

function update(patch: Partial<PanelState>, redraw = true): void {
  state = { ...state, ...patch }
  if (redraw) render()
}

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error))

/** Runs a worker call; a failure shows under the header instead of breaking the panel. */
async function guarded(work: () => Promise<void>): Promise<void> {
  try {
    await work()
    if (state.error) update({ error: null })
  } catch (error) {
    update({ error: message(error) })
  }
}

const selectedKey = (): string | null => (workspaceId ? `selected:${workspaceId}` : null)

const TABS: readonly Tab[] = ['active', 'archive', 'specs']
// The version leaves room to change what is stored without reading old values wrongly.
const queryKey = (workspace: string, tab: Tab): string => `query:v1:${workspace}:${tab}`

async function saveQuery(tab: Tab, query: string): Promise<void> {
  if (!workspaceId) return
  const key = queryKey(workspaceId, tab)
  try {
    await (query ? orca.storage.set(key, query) : orca.storage.delete(key))
  } catch {
    // The search still works; it is just not remembered.
  }
}

async function loadQueries(id: string): Promise<Record<Tab, string>> {
  const queries: Record<Tab, string> = { active: '', archive: '', specs: '' }
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
    update({ error: `Cannot remember the open change: ${message(error)}` })
  }
}

async function loadDetail(name: string): Promise<void> {
  const detail = await orca.plugin.request('changes.detail', { name })
  // Archived or deleted while open: back to the list.
  if (!detail) void saveSelected(null)
  update({ detail, selected: detail ? name : null })
}

async function loadArchivedDetail(folder: string): Promise<void> {
  const archivedDetail = await orca.plugin.request('archive.detail', { folder })
  // Moved or deleted while open: back to the archive list.
  update({ archivedDetail, archivedFolder: archivedDetail ? folder : null })
}

/** Reads the list of the open tab; the lists of the other tabs are read when their tab opens. */
async function loadTab(): Promise<void> {
  if (state.tab === 'archive') update({ archive: await orca.plugin.request('archive.list') })
  else if (state.tab === 'specs') update({ specs: await orca.plugin.request('specs.list') })
}

function refresh(): Promise<void> {
  return guarded(async () => {
    const list = await orca.plugin.request('changes.list')
    // A filter on a state no change has any more is cleared.
    const changes = list.status === 'ok' ? list.changes : []
    const filter = state.filter && stateCounts(changes).some((c) => c.state === state.filter) ? state.filter : null
    update({ list, filter })
    if (state.selected) await loadDetail(state.selected)
    if (list.status === 'ok') {
      await loadTab()
      if (state.archivedFolder) await loadArchivedDetail(state.archivedFolder)
    }
  })
}

async function onWorkspace(id: string | null): Promise<void> {
  const switched = id !== workspaceId
  workspaceId = id
  if (switched) {
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
    // The workspace changed again while the queries were read: the newer call owns the state.
    if (id !== workspaceId) return
    update(
      { selected, detail: null, filter: null, queries, limits: { active: PAGE_SIZE, archive: PAGE_SIZE, specs: PAGE_SIZE }, composer: null, pending: null, agent: null, tab: 'active', archive: null, specs: null, archivedFolder: null, archivedDetail: null },
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
  const agent = await orca.plugin.request('agent.options')
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
    await orca.plugin.request('agent.prefs.set', { workspaceId: workspace, prefs: { profile: state.profile, model: state.model.trim() || null } })
  } catch (error) {
    update({ error: `Cannot remember the agent choice: ${message(error)}` })
  }
}

async function run(launch: { action: AgentAction; change?: string }, input: { prompt?: string }): Promise<boolean> {
  const agent = state.agent
  const info = agent?.profiles.find((p) => p.id === state.profile)
  if (!agent || !info) return false
  update({ starting: true, notice: null })
  try {
    const sessionTarget = state.target.startsWith(SESSION)
    const answer = await orca.plugin.request('agent.run', {
      action: launch.action,
      change: launch.change,
      ...input,
      // What the sheet showed: the host refuses it if the workspace or the session changed since.
      workspaceId: agent.workspaceId,
      profile: state.profile,
      model: info.supportsModel && !sessionTarget ? state.model.trim() || null : null,
      target: toTarget(state.target)
    })
    const what = launch.change ? `${launch.action} ${launch.change}` : launch.action
    const name = answer.agent === 'codex' ? 'Codex' : 'Claude Code'
    const where = answer.surface === 'open-terminal' ? `Sent to the open ${name} terminal` : `${name} started in a new ${answer.surface}`
    update({ notice: { tone: 'success', text: `${where}: ${what}.` } })
    return true
  } catch (error) {
    update({ notice: { tone: 'error', text: message(error) } })
    // The sessions may be why it failed: show the current ones.
    void loadAgent(false).catch(() => undefined)
    return false
  } finally {
    update({ starting: false })
  }
}

const actions: Actions = {
  refresh: () => void refresh(),
  select: (name) => {
    update({ selected: name, detail: null })
    void saveSelected(name)
    if (name) void guarded(() => loadDetail(name))
  },
  setTab: (tab) => {
    update({ tab })
    void guarded(loadTab)
  },
  openArchived: (folder) => {
    update({ archivedFolder: folder, archivedDetail: null })
    if (folder) void guarded(() => loadArchivedDetail(folder))
  },
  openArchivedFile: (name, file) =>
    void guarded(async () => void (await orca.plugin.request('changes.open', { name, file, archived: true }))),
  openSpec: (capability) => void guarded(async () => void (await orca.plugin.request('specs.open', { capability }))),
  setFilter: (filter) => update({ filter, limits: { ...state.limits, active: PAGE_SIZE } }),
  setQuery: (tab, query) => {
    update({ queries: { ...state.queries, [tab]: query }, limits: { ...state.limits, [tab]: PAGE_SIZE } })
    void saveQuery(tab, query)
  },
  loadMore: (tab) => update({ limits: { ...state.limits, [tab]: nextLimit(state.limits[tab]) } }),
  openFile: (name, file) => void guarded(async () => void (await orca.plugin.request('changes.open', { name, file }))),
  // Never sends at once: the sheet shows agent, destination and command first.
  run: (action, change) => {
    update({ pending: { action, change }, composer: null, draft: '', notice: null })
    void guarded(() => loadAgent(true))
  },
  initialize: () => {
    update({ initializing: true })
    void guarded(async () => update({ list: await orca.plugin.request('openspec.init') })).finally(() =>
      update({ initializing: false })
    )
  },
  // The form lives in the Active list: show that first.
  openComposer: (composer) => {
    update({ composer, pending: null, draft: '', notice: null, tab: 'active', archivedFolder: null, archivedDetail: null })
    void guarded(() => loadAgent(true))
  },
  closeComposer: () => update({ composer: null, pending: null }),
  setProfile: (profile) => {
    const info = state.agent?.profiles.find((p) => p.id === profile)
    update({ profile, model: info?.supportsModel ? state.model : '', target: validTarget(state.target, profile) })
    void savePrefs()
  },
  setModel: (model) => {
    update({ model }, false)
    void savePrefs()
  },
  setTarget: (target) => update({ target }),
  // No redraw while typing: the textarea already shows it. Only the Start button follows.
  setDraft: (draft) => {
    update({ draft }, false)
    // The textarea is not redrawn, so the command preview is updated in place.
    const launch = activeLaunch(state)
    const code = root.querySelector('.composer .preview code')
    if (launch && code) {
      const built = buildPrompt(state.profile, launch.action, { change: launch.change, prompt: draft })
      code.textContent = 'prompt' in built ? built.prompt : 'Describe the change to propose.'
    }
    const start = root.querySelector<HTMLButtonElement>('.composer .primary')
    if (start) start.disabled = state.starting || !state.agent || (state.composer === 'propose' && draft.trim() === '')
  },
  submit: () => {
    const launch = activeLaunch(state)
    if (!launch || state.starting || (launch.action === 'propose' && !state.draft.trim())) return
    const free = state.composer !== null
    void run(launch, free ? { prompt: state.draft } : {}).then((ok) => ok && update({ composer: null, pending: null }))
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

const FOCUSABLE = 'button, summary, textarea, select, input'
/** What identifies a control across redraws: its data-focus, else its tag and name. */
const focusKey = (el: Element): string =>
  (el as HTMLElement).dataset?.focus ?? `${el.tagName}:${el.getAttribute('aria-label') ?? el.textContent}`

/** Rebuilds the panel, keeping focus (and the caret) on the control that had it. */
function render(): void {
  const active = document.activeElement
  const key = active && active !== document.body && root.contains(active) ? focusKey(active) : null
  const caret = active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement ? [active.selectionStart, active.selectionEnd] : null
  const notice = state.notice
  const tabs = state.selected || state.archivedFolder ? null : tabBar(state, actions)
  root.replaceChildren(
    header(state, actions),
    // Tabs belong to the lists; a detail has its own back button.
    ...(tabs ? [tabs] : []),
    h('main', { class: 'body' }, [
      state.error ? h('p', { class: 'message error', role: 'alert' }, [state.error]) : null,
      notice ? h('p', { class: `message ${notice.tone === 'error' ? 'error' : 'muted'}`, role: 'status' }, [notice.text]) : null,
      ...(state.selected || state.archivedFolder ? detailView(state, actions) : listView(state, actions))
    ])
  )
  if (!key) return
  let target = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].find((el) => focusKey(el) === key)
  // The last batch removes Load more; keep keyboard navigation at its first new row.
  if (!target && key === `more:${state.tab}`) {
    const row = root.querySelector<HTMLElement>(`.body-list > :nth-child(${state.limits[state.tab] - PAGE_SIZE + 1})`)
    target = row?.matches(FOCUSABLE) ? row : row?.querySelector<HTMLElement>(FOCUSABLE) ?? undefined
  }
  if (!target && key === `clear:${state.tab}`) {
    target = root.querySelector<HTMLElement>('.search-input') ?? undefined
  }
  target?.focus()
  if (caret && (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement)) target.setSelectionRange(caret[0], caret[1])
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

function start(): void {
  const link = h('link', { rel: 'stylesheet', href: new URL('./panel.css', import.meta.url).href })
  document.head.append(link)
  render()
  // workspace.changed fires once on subscribe, which does the first load.
  orca.on('workspace.changed', ({ context }) => void onWorkspace(context?.workspaceId ?? null))
  orca.plugin.on('changes.changed', () => void refresh())
  // A session that finishes or starts asking changes what the open sheet may offer.
  orca.on('agent.status.changed', () => {
    if (activeLaunch(state)) void loadAgent(false).catch(() => undefined)
  })
  // The --orca-* variables and the html class change on their own; nothing to redraw.
  setInterval(() => refreshAges(root), AGE_REFRESH_MS)
  void readVersion()
}

start()
