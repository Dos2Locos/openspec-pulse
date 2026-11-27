// The panel's state and the actions views can call. Kept apart so views stay plain functions.
import type { AgentAction, AgentOptions, ArchivedChange, ArchivedChangeDetail, ChangeDetail, ChangesState, ProfileId, SpecSummary } from '../protocol'
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
  /** An action on a change waiting for the person to confirm agent, destination and command. */
  pending: { action: AgentAction; change: string } | null
  /** Profiles, sessions and the saved choice of the workspace; null until read or without a local one. */
  agent: AgentOptions | null
  profile: ProfileId
  /** Typed model id; '' is the agent's default. */
  model: string
  /** `auto`, `new` or `session:<terminalId>`. */
  target: string
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

export type Launch = { action: AgentAction; change?: string }

/** The command sheet that is open: the free-text form or the confirmation of a change action. */
export function activeLaunch(state: PanelState): Launch | null {
  if (state.composer) return { action: state.composer }
  return state.pending
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
  setProfile(profile: ProfileId): void
  setModel(model: string): void
  setTarget(target: string): void
  setDraft(text: string): void
  submit(): void
  toggleExpanded(key: string): void
  setFolded(key: string, folded: boolean): void
}
