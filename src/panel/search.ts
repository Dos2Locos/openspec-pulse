// Search and paging of the panel lists. Pure functions: no DOM, no host.
import type { ArchivedChange, Change, SpecSummary } from '../protocol'
import type { ChangeState } from '../state'

export const PAGE_SIZE = 40

/** Lowercase without diacritics, so `autenticacion` finds `Autenticación`. */
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Every word of the query must appear in the text; an empty query matches everything. */
export function matches(query: string, ...fields: ReadonlyArray<string | null | undefined>): boolean {
  const words = normalize(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const haystack = normalize(fields.filter(Boolean).join('\n'))
  return words.every((word) => haystack.includes(word))
}

/** Active changes by name, narrowed by the state filter, newest first. */
export function filterActive(
  changes: readonly Change[],
  query: string,
  filter: ChangeState | null,
  stateOf: (change: Change) => ChangeState
): Change[] {
  return [...changes]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .filter((c) => (filter ? stateOf(c) === filter : true) && matches(query, c.name))
}

export const filterArchive = (items: readonly ArchivedChange[], query: string): ArchivedChange[] =>
  items.filter((c) => matches(query, c.name))

export const filterSpecs = (items: readonly SpecSummary[], query: string): SpecSummary[] =>
  items.filter((s) => matches(query, s.capability, s.purpose))

/** The first `limit` items (at least one page) and how many are left. */
export function page<T>(items: readonly T[], limit: number): { shown: T[]; remaining: number } {
  const size = Math.max(limit, PAGE_SIZE)
  return { shown: items.slice(0, size), remaining: Math.max(0, items.length - size) }
}

/** The next page size after pressing Load more. */
export const nextLimit = (limit: number): number => Math.max(limit, PAGE_SIZE) + PAGE_SIZE
