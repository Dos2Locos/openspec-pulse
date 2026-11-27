import { t } from './i18n'
import { aggregateSpend, type Run, type SpendSnapshot } from './spend'
import { estimateUsage, PRICE_DATE, PRICE_SOURCES, type TokenUsage } from './usage-pricing'

export type UsageEvent = { id: string; agent: 'Claude Code' | 'Codex'; model: string; at?: string; tokens: TokenUsage; speed: string; geo: string }
export type UsageRead = { events: UsageEvent[]; discarded: number; truncated: number; files: number; warnings: string[] }
export type UsageSnapshot = { spend: SpendSnapshot; cacheReadTokens: number; cacheWriteTokens: number; files: number; truncated: number; discarded: number; warnings: string[]; priceDate: string; priceSources: string[] }
const obj = (v: unknown): Record<string, any> | null => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, any> : null
const count = (v: unknown) => v === undefined ? 0 : typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : NaN
const pathKey = (s: string) => s.replace(/\/$/, '')
function decode(line: string): Record<string, any> | null { try { return obj(JSON.parse(line)) } catch { return null } }

export function claudeUsage(lines: string[], workspace: string): UsageRead {
  const events = new Map<string, UsageEvent>()
  let discarded = 0, cwd: string | null = null
  for (const line of lines) {
    const d = decode(line)
    if (!d) continue
    if (typeof d.cwd === 'string') cwd = pathKey(d.cwd)
    if (d.type !== 'assistant' || cwd !== pathKey(workspace)) continue
    const m = obj(d.message), u = obj(m?.usage)
    if (!m || !u) continue
    const cache = obj(u.cache_creation)
    const write = count(u.cache_creation_input_tokens)
    const hour = count(cache?.ephemeral_1h_input_tokens)
    const five = cache?.ephemeral_5m_input_tokens === undefined ? write - hour : count(cache.ephemeral_5m_input_tokens)
    const tokens = { input: count(u.input_tokens), output: count(u.output_tokens), cached: count(u.cache_read_input_tokens), write5m: five, write1h: hour }
    if (!Object.values(tokens).every(n => Number.isSafeInteger(n) && n >= 0) || five + hour !== write || typeof m.id !== 'string' || !m.id) { discarded++; continue }
    const id = 'claude:' + m.id
    const event: UsageEvent = { id, agent: 'Claude Code', model: typeof m.model === 'string' ? m.model : '__pulse_no_model__', ...(typeof d.timestamp === 'string' ? { at: d.timestamp } : {}),
      tokens, speed: typeof u.speed === 'string' ? u.speed : u.service_tier && u.service_tier !== 'standard' ? String(u.service_tier) : 'standard', geo: u.inference_geo ?? 'global' }
    const previous = events.get(id)
    // Streaming/tool blocks repeat the same message, with output counts increasing.
    if (previous) for (const key of Object.keys(tokens) as (keyof TokenUsage)[]) event.tokens[key] = Math.max(previous.tokens[key], tokens[key])
    events.set(id, event)
  }
  return { events: [...events.values()], discarded, files: 1, truncated: 0, warnings: [] }
}

export function codexUsage(lines: string[], workspace: string, meta: { id: string; cwd: string; model?: string }, truncated = false): UsageRead {
  const result: UsageRead = { events: [], discarded: 0, files: 1, truncated: truncated ? 1 : 0, warnings: [] }
  if (pathKey(meta.cwd) !== pathKey(workspace)) return { ...result, files: 0 }
  let cwd = pathKey(meta.cwd), model = meta.model ?? '__pulse_no_model__', speed = 'standard'
  let previous = [0, 0, 0, 0], baseline = !truncated
  for (const line of lines) {
    const d = decode(line)
    if (!d) continue
    const p = obj(d.payload)
    if (!p) continue
    if (d.type === 'turn_context') {
      if (typeof p.cwd === 'string') cwd = pathKey(p.cwd)
      model = typeof p.model === 'string' ? p.model : '__pulse_no_model__'
      speed = p.service_tier ?? 'standard'
    }
    if (d.type !== 'event_msg' || p.type !== 'token_count' || !obj(p.info)) continue
    const u = obj(p.info.total_token_usage)
    if (!u) continue
    const total = [count(u.input_tokens), count(u.cached_input_tokens), count(u.cache_write_input_tokens), count(u.output_tokens)]
    if (!total.every(Number.isSafeInteger) || total.some(n => n < 0)) { result.discarded++; continue }
    if (!baseline) { previous = total; baseline = true; continue }
    const reset = total.some((n, i) => n < previous[i])
    const delta = reset ? total : total.map((n, i) => n - previous[i])
    previous = total
    if (cwd !== pathKey(workspace) || delta.every(n => n === 0)) continue
    const [input, cached, write, output] = delta
    if (cached + write > input) { result.discarded++; continue }
    const tokens: TokenUsage = { input: input - cached - write, cached, write5m: write, write1h: 0, output }
    result.events.push({ id: 'codex:' + meta.id + ':' + JSON.stringify([d.timestamp, total]), agent: 'Codex', model,
      ...(typeof d.timestamp === 'string' ? { at: d.timestamp } : {}), tokens, speed, geo: 'global' })
  }
  return result
}

export function summarizeUsage(reads: UsageRead[], identity: string): UsageSnapshot {
  const byId = new Map<string, UsageEvent>()
  for (const read of reads) for (let event of read.events) {
    const old = byId.get(event.id)
    if (old) for (const key of Object.keys(event.tokens) as (keyof TokenUsage)[]) event = { ...event, tokens: { ...event.tokens, [key]: Math.max(event.tokens[key], old.tokens[key]) } }
    byId.set(event.id, event)
  }
  let cacheReadTokens = 0, cacheWriteTokens = 0
  const lines = [...byId.values()].map(event => {
    const t = event.tokens
    cacheReadTokens += t.cached; cacheWriteTokens += t.write5m + t.write1h
    const cost = estimateUsage(event.model, t, event.speed, event.geo)
    const run: Run = { id: event.id, model: event.model, task: event.agent, ...(event.at ? { at: event.at } : {}), inputTokens: t.input + t.cached + t.write5m + t.write1h, outputTokens: t.output, ...(cost === null ? {} : { costUsd: cost }) }
    return JSON.stringify(run)
  })
  return { spend: aggregateSpend(identity, [{ identity, lines, truncated: false }]), cacheReadTokens, cacheWriteTokens,
    files: reads.reduce((n, r) => n + r.files, 0), truncated: reads.reduce((n, r) => n + r.truncated, 0), discarded: reads.reduce((n, r) => n + r.discarded, 0),
    warnings: [...new Set(reads.flatMap(r => r.warnings))], priceDate: PRICE_DATE, priceSources: PRICE_SOURCES }
}
