import { assert, test } from 'orca/testing'
import { buildRelations, relatedChanges, RelationCache } from './relations'
import type { ChangeRef } from './protocol'

const active: ChangeRef = { source: 'active', name: 'same' }
const archived: ChangeRef = { source: 'archive', name: 'same', folder: '2026-11-27-same' }

test('relations separate full paths and origins, deduplicate and omit self and changes without deltas', () => {
  const other: ChangeRef = { source: 'active', name: 'other' }
  const index = buildRelations([
    { change: active, capabilities: ['billing/invoices', 'shared', 'shared'] },
    { change: archived, capabilities: ['billing/invoices', 'shared'] },
    { change: other, capabilities: ['sales/invoices'] },
    { change: { source: 'active', name: 'empty' }, capabilities: [] }
  ])
  assert.deepEqual(index.get('billing/invoices'), [active, archived])
  assert.deepEqual(index.get('sales/invoices'), [other])
  assert.deepEqual(relatedChanges(index, ['billing/invoices', 'shared'], active), [archived])
  assert.deepEqual(relatedChanges(index, ['billing/invoices'], archived), [active])
  assert.deepEqual(relatedChanges(index, [], active), [])
})

test('cache shares reads, isolates workspaces, invalidates in-flight reads and retries errors', async () => {
  const cache = new RelationCache()
  let reads = 0
  const read = async () => { reads++; return buildRelations([{ change: active, capabilities: ['billing'] }]) }
  const [a, b] = await Promise.all([cache.get('w1', read), cache.get('w1', read)])
  assert.equal(a, b)
  assert.equal(reads, 1)
  await cache.get('w2', read)
  assert.equal(reads, 2)
  let finish!: (index: Map<string, ChangeRef[]>) => void
  const stale = cache.get('w1', () => new Promise(resolve => { finish = resolve }))
  await Promise.resolve()
  cache.invalidate()
  const fresh = await cache.get('w1', read)
  finish(new Map())
  await stale
  assert.equal(await cache.get('w1', read), fresh)
  cache.invalidate()
  await assert.rejects(cache.get('w1', async () => { throw new Error('unreadable') }))
  assert.equal((await cache.get('w1', read)).size, 1)
})
