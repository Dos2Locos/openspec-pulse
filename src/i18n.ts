import { en, es, zh, type MessageKey } from './messages'
export type Locale = 'en' | 'es-ES' | 'zh-Hans'
export const catalogs = { en, 'es-ES': es, 'zh-Hans': zh } as const

/** Only Orca's public locale determines the UI language. Explicit Chinese scripts win. */
export function resolveLocale(value: unknown): Locale {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim()) return 'en'
  try {
    const locale = new Intl.Locale(value)
    if (locale.language === 'en') return 'en'
    if (locale.language === 'es') return 'es-ES'
    if (locale.language !== 'zh') return 'en'
    if (locale.script) return locale.script === 'Hans' ? 'zh-Hans' : 'en'
    return !locale.region || ['CN', 'SG'].includes(locale.region) ? 'zh-Hans' : 'en'
  } catch { return 'en' }
}
let current: Locale = 'en'
let localeProvider = (): Locale => current
/** Worker installs an async-request-local provider; surfaces use their own current locale. */
export function configureLocaleProvider(provider: () => Locale): void { localeProvider = provider }
export const uiLocale = (): Locale => localeProvider()
export function setLocale(value: unknown): Locale { return current = resolveLocale(value) }
type Slots<S extends string> = S extends `${string}{p${infer N}}${infer Rest}` ? (N extends `${number}` ? `p${N}` : never) | Slots<Rest> : never
type Arguments<K extends MessageKey> = [Slots<typeof en[K]>] extends [never] ? [] : [Record<Slots<typeof en[K]>, string | number>]

/** Compile-time required parameters and strict runtime validation prevent mixed catalogs. */
export function t<K extends MessageKey>(key: K, ...args: Arguments<K>): string {
  return translate(uiLocale(), key, args[0] as Record<string, string | number> | undefined)
}
export function translate(locale: Locale, key: MessageKey, params: Record<string, string | number> = {}): string {
  const template = catalogs[locale][key]
  if (template === undefined) throw new Error(`Missing UI message: ${key}`)
  const expected = parameters(template)
  if (expected.some(p => !Object.hasOwn(params, p)) || Object.keys(params).some(p => !expected.includes(p))) throw new Error(`Invalid UI parameters: ${key}`)
  return template.replace(/\{(p\d+)\}/g, (_, name: string) => typeof params[name] === 'number' ? number(params[name] as number, locale) : String(params[name]))
}
export const parameters = (text: string): string[] => [...new Set([...text.matchAll(/\{(p\d+)\}/g)].map(m => m[1]))].sort()
export const number = (value: number, locale = uiLocale()): string => new Intl.NumberFormat(locale).format(value)
export const money = (value: number, digits = 6, locale = uiLocale()): string => new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', maximumFractionDigits: digits }).format(value)
export function validateCatalogs(): void {
  for (const catalog of Object.values(catalogs)) {
    if (Object.keys(catalog).sort().join('\n') !== Object.keys(en).sort().join('\n')) throw new Error('UI catalog key mismatch')
    for (const key of Object.keys(en) as MessageKey[]) if (parameters(en[key]).join() !== parameters(catalog[key]).join()) throw new Error(`UI catalog parameters: ${key}`)
  }
}

/** Ordering keeps its canonical diagnostics for classification; only their presentation changes. */
export function ownOrderingDiagnostic(text: string): string {
  const keys = ['Invalid manual order: use a positive integer.', 'Depends on: {p0}', 'Archived dependency (satisfied): {p0}', 'Unknown dependency: {p0}', 'Duplicate manual order: {p0}', 'Manual order conflicts with dependency: {p0}', 'Manual order conflicts with dependent: {p0}', 'Dependency cycle — no valid sequence.', 'Blocked by dependency cycle — no valid sequence.'] as const
  for (const key of keys) {
    const names = parameters(key)
    const pattern = key.split(/\{p\d+\}/g).map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('(.+)')
    const match = new RegExp('^' + pattern + '$').exec(text)
    if (match) return translate(uiLocale(), key, Object.fromEntries(names.map((name, i) => [name, match[i + 1]])))
  }
  return text
}
export function groupLabel(name: string, group?: string, literal = false): string {
  if (literal) return name
  if (group === 'byMonth' && /^\d{4}-\d{2}$/.test(name)) return new Intl.DateTimeFormat(uiLocale(), { year: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(name + '-01T00:00:00Z'))
  return name === '__pulse_no_model__' ? t('No model') : name === '__pulse_no_task__' ? t('No task') : name === '__pulse_no_date__' ? t('No date') : name
}
export type UiMessage = { [K in MessageKey]: { key: K } & ([Slots<typeof en[K]>] extends [never] ? { params?: never } : { params: Record<Slots<typeof en[K]>, string | number> }) }[MessageKey]
export const renderMessage = (message: UiMessage): string => translate(uiLocale(), message.key, message.params)
