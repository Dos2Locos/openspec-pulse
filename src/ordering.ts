// Dependency ordering and local preference validation. No disk, DOM or host access.
import type { Change } from './protocol'

export type OrderingPrefs = { mode: 'recent' | 'dependencies'; favorites: string[] }
export const orderingKey = (workspace: string): string => `ordering:v1:${workspace}`
export function orderingPrefs(value: unknown): OrderingPrefs {
  const v = value as Partial<OrderingPrefs> | null
  return { mode: v?.mode === 'dependencies' ? 'dependencies' : 'recent',
    favorites: Array.isArray(v?.favorites) ? [...new Set(v.favorites.filter((s): s is string => typeof s === 'string'))] : [] }
}

/** Only labelled declarations/sections count; code blocks and casual mentions do not. */
export function parseDependencies(markdown: string): string[] {
  const found = new Set<string>()
  let section = false
  let fence: string | null = null
  for (const line of markdown.split(/\r?\n/)) {
    const f = /^\s*(`{3,}|~{3,})/.exec(line)
    if (f) { if (!fence) fence = f[1][0]; else if (f[1][0] === fence) fence = null; continue }
    if (fence) continue
    const clean = line.replace(/^\s*(?:#{1,6}\s+|[-*+]\s+)?/, '').replace(/\*\*/g, '').trim()
    const label = /^(?:depends on|depende de|dependencies|dependency|dependencias|dependencia)\s*(?::|$)/i.exec(clean)
    if (/^\s*#/.test(line)) section = !!label
    if (label) section = true
    else if (section && line.trim() && !/^\s*[-*+]\s+/.test(line)) section = false
    if (label || section) {
      const content = label ? clean.slice(label[0].length) : line
      for (const match of content.matchAll(/`([^`\r\n]+)`/g)) found.add(match[1].trim())
    }
  }
  return [...found].filter(Boolean)
}

/** Deliberately only reads the top-level scalar `order`; does not rewrite YAML. */
export function parseManualOrder(yaml: string): { order: number | null; warning: string | null } {
  const lines = yaml.split(/\r?\n/).filter(line => /^order\s*:/.test(line))
  if (!lines.length) return { order: null, warning: null }
  const raw = lines[0].replace(/^order\s*:\s*/, '').replace(/\s+#.*$/, '').trim()
  const order = Number(raw)
  if (lines.length !== 1 || !/^\d+$/.test(raw) || !Number.isSafeInteger(order) || order <= 0) {
    return { order: null, warning: 'Invalid manual order: use a positive integer.' }
  }
  return { order, warning: null }
}

export type OrderingResult = { ordered: Change[]; unresolved: Change[]; warnings: Record<string, string[]> }
/** Kahn ordering: cycles and everything blocked by them stay in an explicitly unordered group. */
export function dependencyOrder(changes: readonly Change[]): OrderingResult {
  const byName = new Map(changes.map(c => [c.name, c]))
  const warnings: Record<string, string[]> = Object.create(null)
  const deps = new Map<string, string[]>()
  const orders = new Map<string, number>()
  const warn = (name: string, text: string) => { (warnings[name] ??= []).push(text) }
  for (const c of changes) {
    for (const w of c.ordering?.warnings ?? []) warn(c.name, w)
    const declared = c.ordering?.dependencies ?? []
    deps.set(c.name, declared.filter(d => byName.has(d)))
    for (const d of declared) {
      if (byName.has(d)) warn(c.name, `Depends on: ${d}`)
      else if (c.ordering?.satisfied.includes(d)) warn(c.name, `Archived dependency (satisfied): ${d}`)
      else warn(c.name, `Unknown dependency: ${d}`)
    }
    if (c.ordering?.order != null) orders.set(c.name, c.ordering.order)
  }
  // Reachability detects both actual cycle members and transitive manual-order conflicts.
  const reaches = (start: string, target: string, seen = new Set<string>()): boolean => {
    if (seen.has(start)) return false
    seen.add(start)
    return (deps.get(start) ?? []).some(d => d === target || reaches(d, target, seen))
  }
  const invalid = new Set<string>()
  for (const [a, orderA] of orders) for (const [b, orderB] of orders) {
    if (a === b) continue
    if (orderA === orderB) { invalid.add(a); warn(a, `Duplicate manual order: ${orderA}`) }
    else if (reaches(a, b) && orderA < orderB) {
      invalid.add(a); invalid.add(b)
      warn(a, `Manual order conflicts with dependency: ${b}`)
      warn(b, `Manual order conflicts with dependent: ${a}`)
    }
  }
  for (const n of invalid) orders.delete(n)
  const compare = (a: Change, b: Change): number =>
    (orders.get(a.name) ?? Infinity) - (orders.get(b.name) ?? Infinity) ||
    (a.ordering?.createdAt ?? 0) - (b.ordering?.createdAt ?? 0) || a.name.localeCompare(b.name)
  const remaining = new Set(byName.keys())
  const ordered: Change[] = []
  while (remaining.size) {
    const ready = [...remaining].filter(n => !(deps.get(n) ?? []).some(d => remaining.has(d))).map(n => byName.get(n)!).sort(compare)
    if (!ready.length) break
    const next = ready[0]
    ordered.push(next); remaining.delete(next.name)
  }
  const unresolved = [...remaining].map(n => byName.get(n)!).sort((a, b) => a.name.localeCompare(b.name))
  for (const c of unresolved) warn(c.name, reaches(c.name, c.name) ? 'Dependency cycle — no valid sequence.' : 'Blocked by dependency cycle — no valid sequence.')
  return { ordered, unresolved, warnings }
}
