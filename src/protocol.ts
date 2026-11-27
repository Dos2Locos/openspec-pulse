import type { UsageSnapshot } from './usage'
import type { SpendSnapshot } from './spend'
import type { DeliverySnapshot } from './delivery'
import type { OpenSpecRoot, StoreInfo, StoreOperation, StorePreview } from './stores'
import type { WorkflowInfo } from './config'
// The panel <-> worker contract, declared once: src/panel/ and src/worker.ts both read it.
export type WorktreeOrigin = { workspaceId: string; name: string; branch: string | null }
export type BrowseScope = 'focused' | 'all' | string
export type BrowseSnapshot = { spend?: SpendSnapshot; focusedWorkspaceId: string; worktrees: WorktreeOrigin[]; diagnostics: string[]; list: ChangesState; archive: ArchivedChange[]; specs: SpecSummary[] }

export type Artifact = 'proposal.md' | 'design.md' | 'tasks.md' | 'specs/'

export type TaskCount = { done: number; total: number }

export type Change = {
  readOnly?: boolean
  origin?: WorktreeOrigin
  name: string
  ordering?: { dependencies: string[]; satisfied: string[]; createdAt: number; order: number | null; warnings: string[] }
  missingArtifacts?: Artifact[]
  resume?: string | null
  artifacts: Artifact[]
  /** Checkbox count of tasks.md; null when the change has no tasks.md. */
  tasks: TaskCount | null
  /** Newest `mtimeMs` among the files of the change folder (recursive). */
  updatedAt: number
}

export type Task = { text: string; done: boolean }
/** A `##`/`###` heading of tasks.md and the checkboxes under it; `title` is '' before the first. */
export type TaskSection = { title: string; tasks: Task[] }

/** Zero-based coordinates in the parsed sections, bound to the entire tasks.md read. */
export type TaskSelection = { section: number; position: number; fingerprint: string }
/** Display context only; the worker always resolves it from disk. */
export type TaskContext = { sectionTitle: string; text: string; section: number; position: number }

/** Origin is part of identity: archive folders may share an active change's name. */
export type ChangeRef = { source: 'active'; name: string } | { source: 'archive'; name: string; folder: string }

export type ChangeDetail = Change & {
  related?: ChangeRef[]
  /** Paths relative to the change folder, such as `specs/billing/spec.md`. */
  specs: string[]
  sections: TaskSection[]
  tasksFingerprint?: string
  /** Set by the worker for active local details; binds task actions to their workspace. */
  workspaceId?: string
}

/** An archived change: `folder` is `YYYY-MM-DD-<name>` on disk; `date` is null without that prefix. */
export type ArchivedChange = Change & { folder: string; date: string | null }
export type ArchivedChangeDetail = ChangeDetail & { folder: string; date: string | null }

/** A main spec under `openspec/specs/`: `capability` is its folder path, such as `identity/user-auth`. */
export type SpecSummary = { readOnly?: boolean; origin?: WorktreeOrigin; capability: string; purpose: string | null; requirements: number }

export type SpecDetail = SpecSummary & { changes: ChangeRef[] }

/** What an agent button starts: a new proposal, exploration, or a step on one change. */
export type AgentAction = 'propose' | 'explore' | 'continue' | 'apply' | 'verify' | 'archive' | 'task'

/** Tested agent + command-style pairs; an unknown id is never guessed from a name. */
export type ProfileId = 'claude-skills' | 'codex-skills'

/** What a workspace remembers: the profile and an optional model (Claude only, new sessions only). */
export type AgentPrefs = { profile: ProfileId; model: string | null }

export type ProfileInfo = { id: ProfileId; label: string; agent: 'claude' | 'codex'; supportsModel: boolean }

/** A terminal of the workspace running an agent. `available` is true only in `done` (at its prompt). */
export type SessionInfo = { terminalId: string; title: string | null; agent: string; state: string; available: boolean }

/** `auto` keeps 0.1.0's behavior: the longest-idle session, else a new one. */
export type AgentTarget = 'auto' | 'new' | { terminalId: string }

export type AgentOptions = {
  workflow?: WorkflowInfo
  approvedCommands?: string[]
  workspaceId: string
  profiles: ProfileInfo[]
  prefs: AgentPrefs
  sessions: SessionInfo[]
}

export type ChangesState =
  | { status: 'no-workspace' }
  /** The workspace lives on another host (SSH, WSL…), which the worker cannot read. */
  | { status: 'remote'; workspace: string }
  | { status: 'no-openspec'; workspace: string }
  /** `archived` and `specs` are the counts of the other two tabs. */
  | { status: 'ok'; workspace: string; root?: OpenSpecRoot; workflow?: WorkflowInfo; changes: Change[]; archived: number; specs: number }

declare module 'orca' {
  interface PulseRequests {
    "usage.get": { input: { workspaceId: string; workspaceIds: string[] }; output: UsageSnapshot }
    'stores.info': { input: { workspaceId: string }; output: StoreInfo }
    'stores.preview': { input: { workspaceId: string; operation: StoreOperation }; output: StorePreview }
    'stores.commit': { input: { workspaceId: string; token: string }; output: { saved: boolean } }
    'stores.scope.set': { input: { workspaceId: string; fingerprint: string; prefixes: string[] }; output: { saved: boolean } }
    'board.open': { input: { workspaceId: string }; output: { opened: boolean } }
    'artifacts.read': {
      input: { workspaceId: string; name: string; file: string; archived?: true }
      output: { file: string; markdown: string } | null
    }
    'delivery.get': { input: { workspaceId: string; names: string[] }; output: DeliverySnapshot }
    'delivery.login.set': { input: { workspaceId: string; project: string; login: string | null }; output: { login: string | null } }
    /** The active changes of the focused workspace; also starts watching its files. */
    'changes.list': { output: ChangesState }
    'worktrees.browse': { input: { focusedWorkspaceId: string; scope: BrowseScope }; output: BrowseSnapshot }
    /** One change with its specs and tasks; null when it no longer exists. */
    'changes.detail': { input: { name: string; workspaceId?: string }; output: ChangeDetail | null }
    /**
     * Opens a file of a change (relative to its folder); default tasks.md, else proposal.md. With
     * `archived`, `name` is an archive folder.
     */
    'changes.open': { input: { name: string; file?: string; archived?: true; workspaceId?: string }; output: { opened: boolean } }
    /** The archived changes of the focused workspace, newest first. */
    'archive.list': { output: ArchivedChange[] }
    /** One archived change by folder; null when it no longer exists. */
    'archive.detail': { input: { folder: string; workspaceId?: string }; output: ArchivedChangeDetail | null }
    /** The main specs of the focused workspace, sorted by capability. */
    'specs.list': { output: SpecSummary[] }
    'specs.detail': { input: { capability: string; workspaceId: string }; output: SpecDetail | null }
    /** Opens the spec.md of a listed capability. */
    'specs.open': { input: { capability: string; workspaceId?: string }; output: { opened: boolean } }
    /** Profiles, the focused workspace's saved choice and its agent sessions; null without a local workspace. */
    'agent.options': { output: AgentOptions | null }
    /** Saves the profile and model of a workspace; refused when it is no longer the focused one. */
    'agent.prefs.set': { input: { workspaceId: string; prefs: AgentPrefs }; output: AgentPrefs }
    /**
     * Sends the action's command to the target in the focused workspace and shows it. Everything is
     * checked again here: `workspaceId` must still be focused, a session must still be idle and of
     * the profile's agent. A failure never falls back to another target.
     */
    'agent.run': {
      input: {
        workflowFingerprint?: string | null
        approval?: { fingerprint: string; command: string }
        action: AgentAction
        change?: string
        prompt?: string
        workspaceId?: string
        profile?: ProfileId
        model?: string | null
        target?: AgentTarget
        /** Required for `task`, together with workspaceId; no task text is accepted. */
        task?: TaskSelection
      }
      /** `open-terminal` when sent to a running session; `chat`, or `terminal` when Orca could not open a chat. */
      output: { surface: 'open-terminal' | 'chat' | 'terminal'; agent: 'claude' | 'codex' }
    }
    /** Runs `openspec init` in the focused workspace and answers the new list. */
    'openspec.init': { input: { workspaceId?: string } | undefined; output: ChangesState }
  }
  type LocalizedRequests = { [K in keyof PulseRequests]: PulseRequests[K] & { input: (PulseRequests[K] extends { input: infer I } ? NonNullable<I> : {}) & { locale?: string } } }
  interface PluginRequests extends LocalizedRequests {}
  interface PluginPanelEvents {
    /** Posted when a file under openspec/ of the watched workspace changes. */
    'changes.changed': Record<string, never>
  }
}
