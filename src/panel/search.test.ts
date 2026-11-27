import { assert, test } from 'orca/testing'
import type { SpecSummary } from '../protocol'
import { filterArchive, filterSpecs, matches, nextLimit, normalize, page, PAGE_SIZE } from './search'

const specs = (n: number): SpecSummary[] =>
  Array.from({ length: n }, (_, i) => ({ capability: `area/cap-${i + 1}`, purpose: i === 99 ? 'Gestión de Autenticación' : 'Otra cosa', requirements: 1 }))

test('normalizes case and diacritics', () => {
  assert.equal(normalize('Autenticación'), 'autenticacion')
  assert.ok(matches('autenticacion', 'Autenticación'))
  assert.ok(matches('  ', 'anything'))
  assert.ok(!matches('zzz', 'abc'))
})

test('every word must match, in any order', () => {
  assert.ok(matches('user auth', 'identity/user-auth'))
  assert.ok(!matches('user billing', 'identity/user-auth'))
})

test('a match only the 100th spec has comes first in the filtered list', () => {
  const found = filterSpecs(specs(100), 'autenticacion')
  assert.equal(found.length, 1)
  assert.equal(found[0]?.capability, 'area/cap-100')
  assert.equal(filterSpecs(specs(100), 'AREA/CAP-5').map((s) => s.capability).includes('area/cap-5'), true)
})

test('archive matches names only', () => {
  const items = [{ name: 'add-login', folder: '2026-01-01-add-login', date: '2026-01-01', updatedAt: 1, tasks: null }] as never
  assert.equal(filterArchive(items, 'login').length, 1)
  assert.equal(filterArchive(items, '2026').length, 0)
})

test('pages in batches of 40 over the filtered set', () => {
  const items = Array.from({ length: 85 }, (_, i) => i)
  let limit = PAGE_SIZE
  assert.deepEqual([page(items, limit).shown.length, page(items, limit).remaining], [40, 45])
  limit = nextLimit(limit)
  assert.deepEqual([page(items, limit).shown.length, page(items, limit).remaining], [80, 5])
  limit = nextLimit(limit)
  assert.deepEqual([page(items, limit).shown.length, page(items, limit).remaining], [85, 0])
  // A smaller list after refresh never hides results.
  assert.equal(page(items.slice(0, 10), 40).shown.length, 10)
})
