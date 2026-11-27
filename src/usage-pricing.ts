// USD per million tokens. Reviewed against the official sources below on this date.
// Standard API-equivalent estimates, never a subscription invoice or historical bill.
export const PRICE_DATE = '2026-11-27'
export const PRICE_SOURCES = ['https://platform.claude.com/docs/en/about-claude/pricing', 'https://developers.openai.com/api/docs/pricing']
export type TokenUsage = { input: number; output: number; cached: number; write5m: number; write1h: number }
type Rate = { input: number; output: number; cached: number; write5m: number; write1h: number; fast?: boolean; threshold?: number; high?: Rate }
const rate = (input: number, output: number, cached: number, fast = false): Rate => ({ input, output, cached, write5m: input * 1.25, write1h: input * 2, fast })
const RATES: Record<string, Rate> = {
  'claude-fable-5-2': rate(8, 40, .2, true),
  'claude-mythos-5-2': rate(8, 40, .2, true),
  'claude-fable-5-1': rate(10, 50, .25),
  'claude-mythos-5-1': rate(10, 50, .25),
  'claude-fable-5': rate(10, 50, 1),
  'claude-mythos-5': rate(10, 50, 1),
  'claude-opus-5-5': rate(4, 20, .2, true),
  'claude-opus-5': rate(5, 25, .5, true),
  'claude-opus-4-8': rate(5, 25, .5, true),
  'claude-opus-4-7': rate(5, 25, .5),
  'claude-opus-4-6': rate(5, 25, .5),
  'claude-opus-4-5': rate(5, 25, .5),
  'claude-opus-4-1': rate(15, 75, 1.5),
  'claude-opus-4': rate(15, 75, 1.5),
  'claude-sonnet-5-5': rate(2, 10, .1),
  'claude-sonnet-5': rate(2, 10, .2),
  'claude-sonnet-4-6': rate(3, 15, .3),
  'claude-sonnet-4-5': rate(3, 15, .3),
  'claude-sonnet-4': rate(3, 15, .3),
  'claude-haiku-5-5': { ...rate(.1, .5, .01), threshold: 100_000, high: rate(.5, 2.5, .05) },
  'claude-haiku-4-5': rate(1, 5, .1),
  'gpt-6.2-astra': { ...rate(8, 40, .4, true), write1h: 20 },
  'gpt-6.2-sol': { ...rate(2, 10, .1, true), write1h: 5 },
  'gpt-6-astra': { ...rate(10, 50, 1, true), write1h: 25 },
  'gpt-6.1-sol': { ...rate(2, 10, .1, true), write1h: 5 }
}
export function estimateUsage(model: string, tokens: TokenUsage, speed = 'standard', geo = 'global'): number | null {
  const key = model.replace(/-\d{8}$/, '')
  let r = Object.hasOwn(RATES, key) ? RATES[key] : undefined
  if (!r || !Object.values(tokens).every(n => Number.isSafeInteger(n) && n >= 0)) return null
  if (r.threshold && tokens.input + tokens.cached + tokens.write5m + tokens.write1h > r.threshold) r = r.high!
  if (!['standard', 'fast', 'priority'].includes(speed) || (speed !== 'standard' && !r.fast)) return null
  if (!['global', 'us', 'US'].includes(geo)) return null
  const multiplier = (speed === 'standard' ? 1 : 2) * (geo === 'global' ? 1 : 1.1)
  const value = (tokens.input * r.input + tokens.output * r.output + tokens.cached * r.cached + tokens.write5m * r.write5m + tokens.write1h * r.write1h) / 1_000_000 * multiplier
  return Number.isFinite(value) ? value : null
}
