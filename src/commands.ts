// Builds the first prompt of the agent the panel starts. Pure, no Orca API.
import type { AgentAction } from './protocol'

/** The Claude Code skills OpenSpec installs, invoked as slash commands. */
const COMMANDS: Record<AgentAction, string> = {
  propose: '/openspec-propose',
  explore: '/openspec-explore',
  continue: '/openspec-continue-change',
  apply: '/openspec-apply-change',
  verify: '/openspec-verify-change',
  archive: '/openspec-archive-change'
}
/** Actions on an existing change; the others take free text. */
const CHANGE_ACTIONS: readonly AgentAction[] = ['continue', 'apply', 'verify', 'archive']
export const PROMPT_MAX_CHARS = 4000
/**
 * Change names become part of the agent's prompt and come from folder names a cloned repository
 * controls: no spaces, newlines or other text that could read as instructions.
 */
const SAFE_CHANGE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/
// Control characters (escape sequences included) except tab and newline, which the person typed.
const CONTROL_CHARS = /[\u0000-\u0008\u000B-\u001F\u007F]/g

export function isSafeChangeName(name: unknown): name is string {
  return typeof name === 'string' && SAFE_CHANGE_NAME.test(name)
}

export function isAgentAction(value: unknown): value is AgentAction {
  return typeof value === 'string' && Object.hasOwn(COMMANDS, value)
}

export function isChangeAction(action: AgentAction): boolean {
  return CHANGE_ACTIONS.includes(action)
}

/**
 * The agent's first prompt, or an error message. A change action needs the change name (checked
 * against disk by the caller); `propose` needs a description; `explore` may go without.
 */
export function buildPrompt(
  action: AgentAction,
  input: { change?: string; prompt?: string }
): { prompt: string } | { error: string } {
  const text = (input.prompt ?? '').replace(CONTROL_CHARS, '').trim()
  if (text.length > PROMPT_MAX_CHARS) return { error: `The prompt is over ${PROMPT_MAX_CHARS} characters.` }
  if (isChangeAction(action)) {
    if (!input.change) return { error: `${action} needs a change.` }
    if (!isSafeChangeName(input.change)) return { error: 'The change name has characters OpenSpec does not use.' }
    return { prompt: `${COMMANDS[action]} ${input.change}` }
  }
  if (action === 'propose' && !text) return { error: 'Describe the change to propose.' }
  return { prompt: text ? `${COMMANDS[action]} ${text}` : COMMANDS[action] }
}

// shortcut: always Claude Code, whose OpenSpec skills are slash commands; other agents use other
// syntax ($openspec-… in Codex), so add a setting and a per-agent prefix when one is needed.
const AGENT = 'claude'

/** `orca agent launch` arguments: a Claude chat in the workspace, shown in the current window. */
export function agentLaunchArgs(workspacePath: string, prompt: string): string[] {
  return [
    'agent', 'launch',
    '--agent', AGENT,
    '--worktree', `path:${workspacePath}`,
    '--surface', 'chat',
    '--focus',
    '--prompt', prompt,
    '--json'
  ]
}

function parseCliJson(stdout: string | undefined): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(stdout ?? '')
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** Where Orca opened the agent: `chat` (Orca's `structured` kind), or `terminal` when it fell back. */
export function launchedSurface(stdout: string): 'chat' | 'terminal' {
  const result = parseCliJson(stdout)?.result as { outcome?: { kind?: unknown } } | undefined
  return result?.outcome?.kind === 'terminal' ? 'terminal' : 'chat'
}

/** The error message of a failed `--json` CLI call, if it printed one. */
export function cliError(stdout: string | undefined): string | null {
  const error = parseCliJson(stdout)?.error as { message?: unknown } | undefined
  return typeof error?.message === 'string' ? error.message : null
}

type ListedAgent = { terminalId: string | null; agent: string | null; state: string; stateStartedAt: number }

/**
 * The terminal of the Claude Code session that has been idle the longest, or null. Only `done`
 * (finished its turn, at the prompt): `waiting` and `blocked` sessions are asking the person
 * something, and typing there would answer it.
 */
export function pickIdleClaudeTerminal(agents: readonly ListedAgent[]): string | null {
  const idle = agents
    .filter((a) => a.agent === AGENT && a.terminalId !== null && a.state === 'done')
    .sort((a, b) => a.stateStartedAt - b.stateStartedAt)
  return idle[0]?.terminalId ?? null
}

const PLUGIN_ID = 'openspec-pulse'
const DEV_KEY = `local.${PLUGIN_ID}`
/** `orca plugin open` needs the plugin approved and enabled: running or idle. */
const OPENABLE = new Set(['running', 'idle'])

/**
 * This plugin's key in `orca plugin list --json`: the dev folder (`local.openspec-pulse`) when it is
 * loaded, else an installed `<publisher>.openspec-pulse`; null when neither can be opened.
 */
export function pickPluginKey(stdout: string): string | null {
  const plugins = (parseCliJson(stdout)?.result as { plugins?: unknown } | undefined)?.plugins
  if (!Array.isArray(plugins)) return null
  const keys = plugins
    .filter((p): p is { pluginKey: string; status: string } => typeof p?.pluginKey === 'string' && OPENABLE.has(p.status))
    .map((p) => p.pluginKey)
  return keys.find((key) => key === DEV_KEY) ?? keys.find((key) => key.endsWith(`.${PLUGIN_ID}`)) ?? null
}

/** `orca plugin open` arguments that show the changes panel, opening the sidebar if needed. */
export function openPanelArgs(pluginKey: string): string[] {
  return ['plugin', 'open', pluginKey, '--panel', 'changes', '--json']
}
