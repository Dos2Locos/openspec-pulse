import { t, uiLocale } from './i18n'
// Read-only GitHub adapter, isolated from Orca so every failure can be tested offline.
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { LOGIN, parsePullRequests, type DeliveryInfo, type GithubConfig, type Ticket } from './delivery'
const exec = promisify(execFile)
export type GhRun = (binary: string, args: string[], options: { cwd: string; env: NodeJS.ProcessEnv; timeout: number; maxBuffer: number }) => Promise<{ stdout: string }>
const TTL = 300_000
const RETRY = 60_000
const unknown = (ticket: Ticket | null, error: string): DeliveryInfo => ({ ticket, freshness: 'unknown', checkedAt: null, prs: [], error })

export class GithubDelivery {
  private cache = new Map<string, { good?: DeliveryInfo; attempted: number; error: string | null }>()
  private pending = new Map<string, Promise<DeliveryInfo>>()
  private active = 0
  private queue: (() => void)[] = []
  constructor(private run: GhRun = (binary, args, options) => exec(binary, args, options), private now: () => number = Date.now) {}

  private async limited<T>(work: () => Promise<T>): Promise<T> {
    if (this.active >= 3) await new Promise<void>(resolve => this.queue.push(resolve))
    else this.active++
    try { return await work() }
    finally {
      const next = this.queue.shift()
      if (next) next()
      else this.active--
    }
  }

  get(input: { key: string; cwd: string; binary: string | null; login: string | null; requiredLogin: string | null; github?: GithubConfig; ticket: Ticket | null; validate: () => Promise<void> }): Promise<DeliveryInfo> {
    const { ticket, login, github } = input
    if (!github) return Promise.resolve(unknown(ticket, t("GitHub repositories are not configured.")))
    if (!ticket) return Promise.resolve(unknown(null, t("No ticket rule matches this change.")))
    if (!login || !LOGIN.test(login)) return Promise.resolve(unknown(ticket, t("Choose an expected GitHub login for this project.")))
    if (input.requiredLogin && login.toLowerCase() !== input.requiredLogin) return Promise.resolve(unknown(ticket, t("This project requires {p0}.", { p0: input.requiredLogin })))
    // Bind data to canonical root, config, login and ticket; never reuse it across identities.
    const key = JSON.stringify([uiLocale(), input.key, login.toLowerCase(), github.repositories, ticket.id])
    const existing = this.cache.get(key)
    if (existing && this.now() - existing.attempted < (existing.error ? RETRY : TTL)) {
      return Promise.resolve(existing.good ? { ...existing.good, ticket, freshness: existing.error ? 'stale' : 'current', error: existing.error } : unknown(ticket, existing.error!))
    }
    const pending = this.pending.get(key)
    if (pending) return pending
    const work = this.limited(async () => {
      let error: string | null = null
      let good = existing?.good
      try {
        await input.validate()
        if (!input.binary) throw new Error(t("gh is unavailable. Install GitHub CLI to query pull requests."))
        const env: NodeJS.ProcessEnv = { ...process.env, GH_TOKEN: undefined, GITHUB_TOKEN: undefined, GH_ENTERPRISE_TOKEN: undefined, GITHUB_ENTERPRISE_TOKEN: undefined, GH_HOST: 'github.com', GH_PROMPT_DISABLED: '1' }
        const call = async (args: string[], authenticated = false) => {
          await input.validate()
          try { return (await this.run(input.binary!, args, { cwd: input.cwd, env, timeout: 15_000, maxBuffer: 2 * 1024 * 1024 })).stdout }
          catch { throw new Error(authenticated ? t("GitHub query failed (network, authentication or rate limit). Retry after 60 seconds.") : t("Cannot resolve credentials for the selected GitHub login.")) }
        }
        // Explicit credential lookup. Ignore environment/active-account credentials; never switch accounts.
        const token = (await call(['auth', 'token', '--hostname', 'github.com', '--user', login])).trim()
        if (!token || /\s/.test(token)) throw new Error(t("Cannot resolve credentials for the selected GitHub login."))
        env.GH_TOKEN = token
        let user: unknown
        try { user = JSON.parse(await call(['api', '--hostname', 'github.com', 'user'], true)) }
        catch (error) { if ((error as { code?: string }).code === 'workspace_changed') throw error; throw new Error(t("Cannot verify GitHub identity. Retry after 60 seconds.")) }
        if (!user || typeof user !== 'object' || typeof (user as { login?: unknown }).login !== 'string' || (user as { login: string }).login.toLowerCase() !== login.toLowerCase()) throw new Error(t("GitHub identity differs from the expected login; no PR query was made."))
        const prs = []
        for (const repository of github.repositories) {
          const text = await call(['pr', 'list', '--repo', `github.com/${repository}`, '--state', 'all', '--search', `"${ticket.id}" in:title`, '--limit', '100', '--json', 'number,title,url,state'], true)
          prs.push(...parsePullRequests(text, repository, ticket.id))
        }
        await input.validate()
        good = { ticket, prs, freshness: 'current', checkedAt: this.now(), error: null }
      } catch (failure) {
        // Workspace conflicts must reach the worker, never become cacheable network errors.
        if ((failure as { code?: string }).code === 'workspace_changed') throw failure
        error = (failure as Error).message
      }
      this.cache.delete(key)
      this.cache.set(key, { good, attempted: this.now(), error })
      if (this.cache.size > 512) this.cache.delete(this.cache.keys().next().value!)
      return good ? { ...good, ticket, freshness: error ? 'stale' as const : 'current' as const, error } : unknown(ticket, error!)
    }).finally(() => this.pending.delete(key))
    this.pending.set(key, work)
    return work
  }
}
