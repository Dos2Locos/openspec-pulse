import { t } from './i18n'
// Shared, pure delivery model. GitHub evidence never changes local task progress.
import type { WorkflowConfig } from './config'
import type { TaskCount } from './protocol'

export type TicketRule = { prefix: string; url: string }
export type GithubConfig = { repositories: string[]; match: 'ticket-in-title' }
export type Ticket = { id: string; url: string }
export type PullRequest = { number: number; title: string; url: string; repository: string; state: 'OPEN' | 'CLOSED' | 'MERGED'; reason: string }
export type DeliveryInfo = { ticket: Ticket | null; freshness: 'current' | 'stale' | 'unknown'; checkedAt: number | null; prs: PullRequest[]; error: string | null }
export type DeliverySnapshot = { workspaceId: string; project: string; login: string | null; requiredLogin: string | null; configured: boolean; changes: Record<string, DeliveryInfo> }
export const LOGIN = /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i
export const REPOSITORY = /^[a-z\d](?:[a-z\d-]*[a-z\d])?\/[a-z\d_.-]+$/i
export const PULSE_REPOSITORY = 'dos2locos/openspec-pulse'

export function ticketFor(name: string, rules: readonly TicketRule[] = []): Ticket | null {
  for (const rule of rules) {
    const match = name.match(new RegExp(`^${rule.prefix}-(\\d+)(?:-|$)`, 'i'))
    if (match) {
      const id = `${rule.prefix.toUpperCase()}-${match[1]}`
      return { id, url: rule.url.replace('{ticket}', encodeURIComponent(id)) }
    }
  }
  return null
}

export function requiredLogin(config: WorkflowConfig | null): string | null {
  return config?.github?.repositories.some(r => r.toLowerCase() === PULSE_REPOSITORY) ? 'temperatio' : null
}

export function deliveryStatus(info: DeliveryInfo, tasks: TaskCount | null): string {
  if (info.freshness === 'unknown') return t("Unknown")
  if (info.prs.some(pr => pr.state === 'OPEN')) return t("In review")
  if (info.prs.some(pr => pr.state === 'MERGED')) return !tasks || tasks.total === 0 || tasks.done < tasks.total ? t("Merged with tasks pending") : t("Merged")
  return info.prs.length ? t("Closed without merge") : t("No PRs")
}

/** Untrusted CLI JSON: validate every returned link and apply literal ticket boundaries. */
export function parsePullRequests(text: string, repository: string, ticket: string): PullRequest[] {
  const rows: unknown = JSON.parse(text)
  if (!Array.isArray(rows) || rows.length >= 100) throw new Error(t("Incomplete GitHub result."))
  const boundary = new RegExp(`(?:^|[^a-z0-9])${ticket}(?=$|[^a-z0-9])`, 'i')
  const result: PullRequest[] = []
  for (const row of rows) {
    if (!row || typeof row !== 'object') throw new Error(t("Invalid GitHub result."))
    const pr = row as Record<string, unknown>
    if (typeof pr.title !== 'string' || typeof pr.url !== 'string' || !Number.isSafeInteger(pr.number) || Number(pr.number) <= 0 || !['OPEN', 'CLOSED', 'MERGED'].includes(String(pr.state))) throw new Error(t("Invalid GitHub result."))
    const url = new URL(pr.url)
    if (url.origin !== 'https://github.com' || url.username || url.password || url.search || url.hash || url.pathname.toLowerCase() !== `/${repository}/pull/${pr.number}`.toLowerCase()) continue
    if (!boundary.test(pr.title)) continue
    result.push({ number: Number(pr.number), title: pr.title, url: url.href, repository, state: pr.state as PullRequest['state'], reason: t("Title contains {p0} · {p1}", { p0: ticket, p1: repository }) })
  }
  return result
}
