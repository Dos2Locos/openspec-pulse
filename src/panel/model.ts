import type { UsageSnapshot } from '../usage'
import type { DeliverySnapshot } from '../delivery'
import type { StoreInfo, StoreOperation, StorePreview } from '../stores'
// The panel's state and the actions views can call. Kept apart so views stay plain functions.
import type { AgentAction, AgentOptions, AgentTarget, ArchivedChange, ArchivedChangeDetail, ChangeDetail, ChangesState, ProfileId, SpecDetail, ChangeRef, SpecSummary, TaskContext, TaskSelection, BrowseSnapshot } from '../protocol'
import type { OrderingPrefs } from '../ordering'
import type { ChangeState } from '../state'

export type FreeAction = Extract<AgentAction, 'propose' | 'explore'>
export type ListTab = 'active' | 'archive' | 'specs'
export type Tab = ListTab | 'stores' | 'spend'
export type Notice = { tone: 'success' | 'error'; text: string }

export type PanelState = {
  usage?: UsageSnapshot | null
  usageError?: string | null
  usageLoading?: boolean
  usageGroup?: 'byTask' | 'byModel' | 'byMonth'
  usageLimit?: number
  spendGroup?: "byTask" | "byModel" | "byMonth"
  spendLimit?: number
  spendStale?: boolean
  storesLoading?: boolean
  storesError?: string | null
  stores?: StoreInfo | null
  storePreview?: StorePreview | null
  storeBusy?: boolean
  storeDraft?: { id: string; path: string; prefixes: string }
  board?: boolean
  preview?: { file: string; markdown: string | null; error: string | null } | null
  delivery?: Record<string, DeliverySnapshot>
  deliverySaving?: boolean
  githubLoginDraft?: string | null
  githubPreferencesOpen?: boolean
  workflowConsent?: { fingerprint: string; command: string } | null
  browse?: BrowseSnapshot | null
  scope?: string
  originId?: string | null
  readOnly?: boolean
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
  specCapability: string | null
  specDetail: SpecDetail | null
  history: NavigationEntry[]
  relationQuery: string
  relationLimit: number
  ordering: OrderingPrefs
  filter: ChangeState | null
  /** The search text and the number of rows shown of each tab; both are kept per tab. */
  queries: Record<ListTab, string>
  limits: Record<ListTab, number>
  error: string | null
  notice: Notice | null
  /** The open first-prompt form. */
  composer: FreeAction | null
  /** An action on a change waiting for the person to confirm agent, destination and command. */
  pending: (Launch & { change: string }) | null
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

export type NavigationEntry = {
  tab: Tab; selected: string | null; archivedFolder: string | null; specCapability: string | null
  relationQuery: string; relationLimit: number; focus: string | null
}

export type Launch = { action: AgentAction; change?: string; task?: TaskSelection & TaskContext; workspaceId?: string }

export function archiveDestination(change: string, now = new Date()): string {
  const date = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-')
  return `openspec/changes/archive/${date}-${change}`
}

/** Orca's request bridge accepts JSON values: absent fields must be omitted, never undefined. */
export function agentRunInput(launch: Launch, options: {
  workspaceId: string; profile: ProfileId; model: string | null; target: AgentTarget; prompt?: string; workflowFingerprint?: string | null; approval?: { fingerprint: string; command: string }
}) {
  return {
    action: launch.action,
    ...(options.workflowFingerprint !== undefined ? { workflowFingerprint: options.workflowFingerprint } : {}),
    ...(options.approval ? { approval: options.approval } : {}),
    ...(launch.change !== undefined ? { change: launch.change } : {}),
    ...(launch.task ? { task: { section: launch.task.section, position: launch.task.position, fingerprint: launch.task.fingerprint } } : {}),
    ...(options.prompt !== undefined ? { prompt: options.prompt } : {}),
    workspaceId: launch.workspaceId ?? options.workspaceId,
    profile: options.profile,
    model: options.model,
    target: options.target
  }
}

/** The command sheet that is open: the free-text form or the confirmation of a change action. */
export function activeLaunch(state: PanelState): Launch | null {
  if (state.composer) return { action: state.composer }
  return state.pending
}

export type Actions = {
  setUsageGroup(group: 'byTask' | 'byModel' | 'byMonth'): void
  moreUsage(): void
  setSpendGroup(group: "byTask" | "byModel" | "byMonth"): void
  moreSpend(): void
  setStoreDraft(field: 'id' | 'path' | 'prefixes', value: string): void
  previewStore(operation: StoreOperation): void
  cancelStore(): void
  commitStore(): void
  saveStoreScope(): void
  openBoard(): void
  previewFile(file: string): void
  closePreview(): void
  saveGithubLogin(login: string | null): void
  setGithubLoginDraft(login: string): void
  setGithubPreferencesOpen(open: boolean): void
  acceptWorkflow(fingerprint: string, command: string, accepted: boolean): void
  setScope(scope: string): void
  refresh(): void
  back(): void
  showSpec(capability: string, workspaceId?: string): void
  showRelated(change: ChangeRef): void
  setRelationQuery(query: string): void
  moreRelations(): void
  select(name: string | null, workspaceId?: string): void
  setTab(tab: Tab): void
  openArchived(folder: string | null, workspaceId?: string): void
  openArchivedFile(folder: string, file: string): void
  openSpec(capability: string): void
  setOrdering(mode: OrderingPrefs['mode']): void
  toggleFavorite(name: string): void
  setFilter(state: ChangeState | null): void
  setQuery(tab: ListTab, query: string): void
  loadMore(tab: ListTab): void
  openFile(name: string, file?: string): void
  run(action: AgentAction, change: string): void
  runTask(change: string, task: TaskSelection & TaskContext, workspaceId: string): void
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
