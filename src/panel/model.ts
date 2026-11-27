// The panel's state and the actions views can call. Kept apart so views stay plain functions.
import type { AgentAction, ArchivedChange, ArchivedChangeDetail, ChangeDetail, ChangesState, SpecSummary } from '../protocol'
import type { ChangeState } from '../state'

export type FreeAction = Extract<AgentAction, 'propose' | 'explore'>
export type Tab = 'active' | 'archive' | 'specs'
export type Notice = { tone: 'success' | 'error'; text: string }

export type PanelState = {
  /** null until the worker first answers. */
  list: ChangesState | null
  /** The change whose detail is shown; null shows the list. */
  selected: string | null
  detail: ChangeDetail | null
  tab: Tab
  /** Loaded when their tab opens; null until then. */
  archive: ArchivedChange[] | null
  specs: SpecSummary[] | null
  /** The archive folder whose read-only detail is shown; null shows the tab's list. */
  archivedFolder: string | null
  archivedDetail: ArchivedChangeDetail | null
  filter: ChangeState | null
  error: string | null
  notice: Notice | null
  /** The open first-prompt form. */
  composer: FreeAction | null
  draft: string
  /** An agent command is being sent. */
  starting: boolean
  initializing: boolean
  /** The plugin version from its manifest; null when it cannot be read. */
  version: string | null
  /** Keys of long tasks shown in full, and of task sections the person folded. */
  expanded: ReadonlySet<string>
  folded: ReadonlySet<string>
}

export type Actions = {
  refresh(): void
  select(name: string | null): void
  setTab(tab: Tab): void
  openArchived(folder: string | null): void
  openArchivedFile(folder: string, file: string): void
  openSpec(capability: string): void
  setFilter(state: ChangeState | null): void
  openFile(name: string, file?: string): void
  run(action: AgentAction, change: string): void
  initialize(): void
  openComposer(action: FreeAction): void
  closeComposer(): void
  setDraft(text: string): void
  submit(): void
  toggleExpanded(key: string): void
  setFolded(key: string, folded: boolean): void
}
