// The panel <-> worker contract, declared once: src/panel/ and src/worker.ts both read it.
export type Artifact = 'proposal.md' | 'design.md' | 'tasks.md' | 'specs/'

export type TaskCount = { done: number; total: number }

export type Change = {
  name: string
  artifacts: Artifact[]
  /** Checkbox count of tasks.md; null when the change has no tasks.md. */
  tasks: TaskCount | null
  /** Newest `mtimeMs` among the files of the change folder (recursive). */
  updatedAt: number
}

export type Task = { text: string; done: boolean }
/** A `##`/`###` heading of tasks.md and the checkboxes under it; `title` is '' before the first. */
export type TaskSection = { title: string; tasks: Task[] }

export type ChangeDetail = Change & {
  /** Paths relative to the change folder, such as `specs/billing/spec.md`. */
  specs: string[]
  sections: TaskSection[]
}

/** An archived change: `folder` is `YYYY-MM-DD-<name>` on disk; `date` is null without that prefix. */
export type ArchivedChange = Change & { folder: string; date: string | null }
export type ArchivedChangeDetail = ChangeDetail & { folder: string; date: string | null }

/** A main spec under `openspec/specs/`: `capability` is its folder path, such as `identity/user-auth`. */
export type SpecSummary = { capability: string; purpose: string | null; requirements: number }

/** What an agent button starts: a new proposal, exploration, or a step on one change. */
export type AgentAction = 'propose' | 'explore' | 'continue' | 'apply' | 'verify' | 'archive'

export type ChangesState =
  | { status: 'no-workspace' }
  /** The workspace lives on another host (SSH, WSL…), which the worker cannot read. */
  | { status: 'remote'; workspace: string }
  | { status: 'no-openspec'; workspace: string }
  /** `archived` and `specs` are the counts of the other two tabs. */
  | { status: 'ok'; workspace: string; changes: Change[]; archived: number; specs: number }

declare module 'orca' {
  interface PluginRequests {
    /** The active changes of the focused workspace; also starts watching its files. */
    'changes.list': { output: ChangesState }
    /** One change with its specs and tasks; null when it no longer exists. */
    'changes.detail': { input: { name: string }; output: ChangeDetail | null }
    /**
     * Opens a file of a change (relative to its folder); default tasks.md, else proposal.md. With
     * `archived`, `name` is an archive folder.
     */
    'changes.open': { input: { name: string; file?: string; archived?: true }; output: { opened: boolean } }
    /** The archived changes of the focused workspace, newest first. */
    'archive.list': { output: ArchivedChange[] }
    /** One archived change by folder; null when it no longer exists. */
    'archive.detail': { input: { folder: string }; output: ArchivedChangeDetail | null }
    /** The main specs of the focused workspace, sorted by capability. */
    'specs.list': { output: SpecSummary[] }
    /** Opens the spec.md of a listed capability. */
    'specs.open': { input: { capability: string }; output: { opened: boolean } }
    /**
     * Sends the action's command to an idle Claude Code terminal of the focused workspace, or else
     * starts Claude in a new chat; either way it is shown.
     */
    'agent.run': {
      input: { action: AgentAction; change?: string; prompt?: string }
      /** `open-terminal` when sent to a running session; `chat`, or `terminal` when Orca could not open a chat. */
      output: { surface: 'open-terminal' | 'chat' | 'terminal' }
    }
    /** Runs `openspec init` in the focused workspace and answers the new list. */
    'openspec.init': { output: ChangesState }
  }
  interface PluginPanelEvents {
    /** Posted when a file under openspec/ of the watched workspace changes. */
    'changes.changed': Record<string, never>
  }
}
