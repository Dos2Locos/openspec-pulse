import { t } from './i18n'
import { validateRuns, type RunsConfig } from './spend'
// Pure project configuration contract, shared by the worker and command preview.
import type { AgentAction, Artifact } from './protocol'
import { REPOSITORY, type TicketRule, type GithubConfig } from './delivery'

export type WorkflowConfig = { schemaVersion: 1; runs?: RunsConfig | false; tickets?: TicketRule[]; github?: GithubConfig; requiredArtifacts?: Artifact[]; resumePrefixes?: string[]; commands?: Partial<Record<AgentAction, string>> }
export type WorkflowInfo = { config: WorkflowConfig | null; fingerprint: string | null; error: string | null }
export const CONFIG_MAX_BYTES = 64 * 1024
const ARTIFACTS = ['proposal.md', 'design.md', 'tasks.md', 'specs/']
const ACTIONS = ['propose', 'explore', 'continue', 'apply', 'verify', 'archive', 'task']
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const controls = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/

export function parseWorkflow(text: string): WorkflowConfig {
  const value: unknown = JSON.parse(text)
  if (!object(value) || value.schemaVersion !== 1) throw new Error(t("schemaVersion must be 1."))
  for (const key of Object.keys(value)) if (!['schemaVersion', 'requiredArtifacts', 'resumePrefixes', 'commands', 'tickets', 'github', 'runs'].includes(key)) throw new Error(t("Unknown key: {p0}.", { p0: key }))
  if ('runs' in value) validateRuns(value.runs)
  if ('tickets' in value) {
    if (!Array.isArray(value.tickets) || value.tickets.length > 32) throw new Error(t("tickets must contain at most 32 rules."))
    const prefixes = new Set<string>()
    for (const rule of value.tickets) {
      if (!object(rule) || Object.keys(rule).some(k => !['prefix', 'url'].includes(k)) || typeof rule.prefix !== 'string' || !/^[a-z]{1,20}$/i.test(rule.prefix) || typeof rule.url !== 'string' || controls.test(rule.url)) throw new Error(t("Invalid ticket rule."))
      const key = rule.prefix.toUpperCase()
      if (prefixes.has(key)) throw new Error(t("Duplicate ticket prefix."))
      prefixes.add(key)
      const url = new URL(rule.url)
      if (url.protocol !== 'https:' || url.username || url.password || rule.url.split('{ticket}').length !== 2 || /[{}]/.test(rule.url.replace('{ticket}', ''))) throw new Error(t("Ticket URL must be HTTPS with one {ticket} placeholder."))
      if (url.host.includes('{ticket}')) throw new Error(t("Ticket placeholder must be outside the URL host."))
    }
  }
  if ('github' in value) {
    const g = value.github
    if (!object(g) || Object.keys(g).some(k => !['repositories', 'match'].includes(k)) || g.match !== 'ticket-in-title' || !Array.isArray(g.repositories) || !g.repositories.length || g.repositories.length > 10 || g.repositories.some(r => typeof r !== 'string' || !REPOSITORY.test(r)) || new Set(g.repositories.map(r => String(r).toLowerCase())).size !== g.repositories.length) throw new Error(t("github needs unique owner/repo repositories (1–10) and match: ticket-in-title."))
  }
  if ('requiredArtifacts' in value && (!Array.isArray(value.requiredArtifacts) || value.requiredArtifacts.some(a => typeof a !== 'string' || !ARTIFACTS.includes(a)))) throw new Error(t("requiredArtifacts must contain canonical artifacts only."))
  if ('resumePrefixes' in value && (!Array.isArray(value.resumePrefixes) || value.resumePrefixes.some(p => typeof p !== 'string' || !p.trim() || controls.test(p)))) throw new Error(t("resumePrefixes must contain nonempty literal single-line prefixes."))
  if ('commands' in value) {
    if (!object(value.commands)) throw new Error(t("commands must be an object."))
    for (const [action, template] of Object.entries(value.commands)) {
      if (!ACTIONS.includes(action)) throw new Error(t("Unknown command action: {p0}.", { p0: action }))
      if (typeof template !== 'string' || !template.trim() || controls.test(template)) throw new Error(t("commands.{p0} must be nonempty single-line text without controls.", { p0: action }))
      const allowed = action === 'propose' || action === 'explore' ? ['prompt'] : action === 'task' ? ['change', 'task'] : ['change']
      for (const match of template.matchAll(/\{([^{}]*)\}/g)) if (!allowed.includes(match[1])) throw new Error(t("Unknown placeholder {{p0}} for {p1}.", { p0: match[1], p1: action }))
      if (/[{}]/.test(template.replace(/\{([^{}]*)\}/g, ''))) throw new Error(t("Malformed placeholder in commands.{p0}.", { p0: action }))
    }
  }
  return value as WorkflowConfig
}

/** First matching paragraph. Its content is display text, never an instruction to execute. */
export function resumeParagraph(markdown: string, prefixes: readonly string[] = []): string | null {
  const lines = markdown.split(/\r?\n/)
  let fenced = false
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*(```|~~~)/.test(lines[i])) { fenced = !fenced; continue }
    if (fenced || !prefixes.some(prefix => lines[i].trimStart().startsWith(prefix))) continue
    const paragraph = [lines[i].trim()]
    while (i + 1 < lines.length && lines[i + 1].trim() && !/^\s*(#|[-*+]\s|```|~~~)/.test(lines[i + 1])) paragraph.push(lines[++i].trim())
    return paragraph.join('\n')
  }
  return null
}
