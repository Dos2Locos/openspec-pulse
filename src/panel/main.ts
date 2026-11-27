// OpenSpec Pulse html panel. No build step: Orca transpiles this file and its imports when the
// panel loads. One state object; render() rebuilds the DOM from it.
import type { AgentAction } from '../protocol'
import { stateCounts } from '../state'
import { detailView } from './detail'
import { h } from './dom'
import type { Actions, PanelState } from './model'
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
  error: null,
  notice: null,
  composer: null,
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
    update(
      { selected, detail: null, filter: null, composer: null, tab: 'active', archive: null, specs: null, archivedFolder: null, archivedDetail: null },
      false
    )
  }
  await refresh()
}

async function run(action: AgentAction, input: { change?: string; prompt?: string }): Promise<boolean> {
  update({ starting: true, notice: null })
  try {
    const { surface } = await orca.plugin.request('agent.run', { action, ...input })
    const what = input.change ? `${action} ${input.change}` : action
    const where = surface === 'open-terminal' ? 'Sent to the open Claude Code terminal' : `Claude started in a new ${surface}`
    update({ notice: { tone: 'success', text: `${where}: ${what}.` } })
    return true
  } catch (error) {
    update({ notice: { tone: 'error', text: message(error) } })
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
  setFilter: (filter) => update({ filter }),
  openFile: (name, file) => void guarded(async () => void (await orca.plugin.request('changes.open', { name, file }))),
  run: (action, change) => void run(action, { change }),
  initialize: () => {
    update({ initializing: true })
    void guarded(async () => update({ list: await orca.plugin.request('openspec.init') })).finally(() =>
      update({ initializing: false })
    )
  },
  // The form lives in the Active list: show that first.
  openComposer: (composer) => update({ composer, draft: '', notice: null, tab: 'active', archivedFolder: null, archivedDetail: null }),
  closeComposer: () => update({ composer: null }),
  // No redraw while typing: the textarea already shows it. Only the Start button follows.
  setDraft: (draft) => {
    update({ draft }, false)
    const start = root.querySelector<HTMLButtonElement>('.composer .primary')
    if (start) start.disabled = state.starting || (state.composer === 'propose' && draft.trim() === '')
  },
  submit: () => {
    const action = state.composer
    if (!action || state.starting || (action === 'propose' && !state.draft.trim())) return
    void run(action, { prompt: state.draft }).then((ok) => ok && update({ composer: null }))
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

const FOCUSABLE = 'button, summary, textarea'
/** What identifies a control across redraws: its data-focus, else its tag and name. */
const focusKey = (el: Element): string =>
  (el as HTMLElement).dataset?.focus ?? `${el.tagName}:${el.getAttribute('aria-label') ?? el.textContent}`

/** Rebuilds the panel, keeping focus (and the caret) on the control that had it. */
function render(): void {
  const active = document.activeElement
  const key = active && active !== document.body && root.contains(active) ? focusKey(active) : null
  const caret = active instanceof HTMLTextAreaElement ? [active.selectionStart, active.selectionEnd] : null
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
  const target = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].find((el) => focusKey(el) === key)
  target?.focus()
  if (caret && target instanceof HTMLTextAreaElement) target.setSelectionRange(caret[0], caret[1])
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
  // The --orca-* variables and the html class change on their own; nothing to redraw.
  setInterval(() => refreshAges(root), AGE_REFRESH_MS)
  void readVersion()
}

start()
