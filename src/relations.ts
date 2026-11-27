import type { ChangeRef } from './protocol'

export const relationKey = (change: ChangeRef): string =>
  change.source === 'active' ? `active:${change.name}` : `archive:${change.folder}`

/** Full capability paths are keys; names alone never identify archived changes. */
export function buildRelations(entries: readonly { change: ChangeRef; capabilities: readonly string[] }[]): Map<string, ChangeRef[]> {
  const index = new Map<string, Map<string, ChangeRef>>()
  for (const { change, capabilities } of entries) {
    for (const capability of new Set(capabilities)) {
      const refs = index.get(capability) ?? new Map<string, ChangeRef>()
      refs.set(relationKey(change), change)
      index.set(capability, refs)
    }
  }
  return new Map([...index].map(([capability, refs]) => [capability, [...refs.values()]]))
}

export function relatedChanges(index: ReadonlyMap<string, ChangeRef[]>, capabilities: readonly string[], current: ChangeRef): ChangeRef[] {
  const refs = new Map<string, ChangeRef>()
  for (const capability of capabilities) {
    for (const ref of index.get(capability) ?? []) {
      if (relationKey(ref) !== relationKey(current)) refs.set(relationKey(ref), ref)
    }
  }
  return [...refs.values()]
}

/** One lazy snapshot; invalidation also discards in-flight builds and failed reads. */
export class RelationCache {
  private entry: { key: string; value: Promise<Map<string, ChangeRef[]>> } | null = null

  invalidate(): void { this.entry = null }

  get(key: string, read: () => Promise<Map<string, ChangeRef[]>>): Promise<Map<string, ChangeRef[]>> {
    if (this.entry?.key === key) return this.entry.value
    const entry = { key, value: Promise.resolve().then(read) }
    this.entry = entry
    void entry.value.catch(() => { if (this.entry === entry) this.invalidate() })
    return entry.value
  }
}
