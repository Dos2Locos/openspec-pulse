// Builds the first prompt of the agent the panel starts. Pure, no Orca API.
import type { AgentAction, AgentPrefs, AgentTarget, ProfileId, ProfileInfo, SessionInfo } from './protocol'

export const DEFAULT_PROFILE: ProfileId = 'claude-skills'

type Profile = ProfileInfo & { prefix: string }
/**
 * The tested pairs, and nothing else. OpenSpec's skills are `openspec-<step>`: Claude Code runs
 * them as `/openspec-<step>`, Codex as `$openspec-<step>`. Not a text swap of one for the other:
 * add a profile only after trying its syntax in that agent.
 */
const PROFILES: Record<ProfileId, Profile> = {
  'claude-skills': { id: 'claude-skills', label: 'Claude Code · skills', agent: 'claude', supportsModel: true, prefix: '/' },
  'codex-skills': { id: 'codex-skills', label: 'Codex · skills', agent: 'codex', supportsModel: false, prefix: '$' }
}
const SKILLS: Record<AgentAction, string> = {
  propose: 'openspec-propose',
  explore: 'openspec-explore',
  continue: 'openspec-continue-change',
  apply: 'openspec-apply-change',
  verify: 'openspec-verify-change',
  archive: 'openspec-archive-change'
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
  return typeof value === 'string' && Object.hasOwn(SKILLS, value)
}

export function isProfileId(value: unknown): value is ProfileId {
  return typeof value === 'string' && Object.hasOwn(PROFILES, value)
}

export function profileInfo(id: ProfileId): ProfileInfo {
  const { prefix: _prefix, ...info } = PROFILES[id]
  return info
}

export const listProfiles = (): ProfileInfo[] => (Object.keys(PROFILES) as ProfileId[]).map(profileInfo)

/** Model ids are passed as one CLI argument: only the characters real ids use, never a flag. */
const SAFE_MODEL = /^[A-Za-z0-9][A-Za-z0-9._:/@-]{0,63}$/

/**
 * The model to launch with, or an error. `null` / '' is the agent's default. A profile without
 * model support refuses one instead of ignoring it, so the person is never told it applies.
 */
export function checkModel(profile: ProfileId, model: unknown): { model: string | null } | { error: string } {
  if (model === null || model === undefined || model === '') return { model: null }
  if (typeof model !== 'string' || !SAFE_MODEL.test(model.trim())) return { error: 'The model id has characters models do not use.' }
  if (!PROFILES[profile].supportsModel) return { error: `${PROFILES[profile].label} cannot choose a model.` }
  return { model: model.trim() }
}

/** A stored value read back as preferences; anything unknown or invalid becomes the 0.1.0 default. */
export function readPrefs(stored: unknown): AgentPrefs {
  const value = (stored && typeof stored === 'object' ? stored : {}) as { profile?: unknown; model?: unknown }
  const profile = isProfileId(value.profile) ? value.profile : DEFAULT_PROFILE
  const checked = checkModel(profile, value.model)
  return { profile, model: 'model' in checked ? checked.model : null }
}

export function isChangeAction(action: AgentAction): boolean {
  return CHANGE_ACTIONS.includes(action)
}

/**
 * The agent's first prompt, or an error message. A change action needs the change name (checked
 * against disk by the caller); `propose` needs a description; `explore` may go without.
 */
export function buildPrompt(
  profile: ProfileId,
  action: AgentAction,
  input: { change?: string; prompt?: string }
): { prompt: string } | { error: string } {
  if (!isProfileId(profile)) return { error: `Unknown profile ${String(profile)}.` }
  const command = `${PROFILES[profile].prefix}${SKILLS[action]}`
  const text = (input.prompt ?? '').replace(CONTROL_CHARS, '').trim()
  if (text.length > PROMPT_MAX_CHARS) return { error: `The prompt is over ${PROMPT_MAX_CHARS} characters.` }
  if (isChangeAction(action)) {
    if (!input.change) return { error: `${action} needs a change.` }
    if (!isSafeChangeName(input.change)) return { error: 'The change name has characters OpenSpec does not use.' }
    return { prompt: `${command} ${input.change}` }
  }
  if (action === 'propose' && !text) return { error: 'Describe the change to propose.' }
  return { prompt: text ? `${command} ${text}` : command }
}

/** `orca agent launch` arguments: the profile's agent in the workspace, shown in the current window. */
export function agentLaunchArgs(profile: ProfileId, workspacePath: string, prompt: string, model: string | null = null): string[] {
  return [
    'agent', 'launch',
    '--agent', PROFILES[profile].agent,
    '--worktree', `path:${workspacePath}`,
    '--surface', 'chat',
    '--focus',
    ...(model && PROFILES[profile].supportsModel ? ['--model', model] : []),
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

type ListedAgent = { terminalId: string | null; title?: string | null; agent: string | null; state: string; stateStartedAt: number }

/**
 * The terminal of the profile's agent that has been idle the longest, or null. Only `done`
 * (finished its turn, at the prompt): `waiting` and `blocked` sessions are asking the person
 * something, and typing there would answer it.
 */
export function pickIdleTerminal(profile: ProfileId, agents: readonly ListedAgent[]): string | null {
  const idle = agents
    .filter((a) => a.agent === PROFILES[profile].agent && a.terminalId !== null && a.state === 'done')
    .sort((a, b) => a.stateStartedAt - b.stateStartedAt)
  return idle[0]?.terminalId ?? null
}

/** Why a chosen terminal cannot take the prompt now, or null when it can. */
export function sessionProblem(profile: ProfileId, agents: readonly ListedAgent[], terminalId: string): string | null {
  const session = agents.find((a) => a.terminalId === terminalId)
  if (!session) return 'That session is no longer in this workspace.'
  if (session.agent !== PROFILES[profile].agent) return `That session is not running ${PROFILES[profile].agent}.`
  if (session.state !== 'done') return `That session is ${session.state}; choose another destination.`
  return null
}

/** The agent sessions the panel can offer for a workspace: terminals running a profiled agent. */
export function listSessions(agents: readonly ListedAgent[]): SessionInfo[] {
  const known = new Set(Object.values(PROFILES).map((p) => p.agent as string))
  return agents
    .filter((a): a is ListedAgent & { terminalId: string; agent: string } => a.terminalId !== null && a.agent !== null && known.has(a.agent))
    .map((a) => ({ terminalId: a.terminalId, title: a.title ?? null, agent: a.agent, state: a.state, available: a.state === 'done' }))
}

export function isTarget(value: unknown): value is AgentTarget {
  if (value === 'auto' || value === 'new') return true
  const id = (value as { terminalId?: unknown } | null)?.terminalId
  return typeof id === 'string' && id.length > 0 && id.length <= 200
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
