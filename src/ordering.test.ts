import { assert, test } from 'orca/testing'
import type { Change } from './protocol'
import { dependencyOrder, orderingKey, orderingPrefs, parseDependencies, parseManualOrder } from './ordering'

const change = (name: string, dependencies: string[] = [], createdAt = 0, order: number | null = null): Change => ({
  name, artifacts: [], tasks: null, updatedAt: 0,
  ordering: { dependencies, satisfied: [], createdAt, order, warnings: [] }
})
const names = (changes: Change[]) => changes.map(c => c.name)

test('recognizes explicit ES/EN declarations and sections, ignoring prose and fenced examples', () => {
  for (const label of ['Depends on', 'Depende de', 'Dependency', 'Dependencies', 'Dependencia', 'Dependencias']) {
    assert.deepEqual(parseDependencies(`**${label}:** \`base\`, \`other\`\nCasual mention \`ignored\``), ['base', 'other'])
    assert.deepEqual(parseDependencies(`## ${label}\n\n- \`base\`\n- \`other\`\n## Impact\n- \`ignored\``), ['base', 'other'])
  }
  assert.deepEqual(parseDependencies('Mention `other`\n```md\nDepends on: `example`\n```\nDepends on: `base`\nDepends on: `base`'), ['base'])
  assert.deepEqual(parseDependencies('Depends on: archived capabilities in 0.1.0.'), [])
})

test('stable DAG ordering respects transitive edges and creation/name ties independently of input', () => {
  const input = [change('c', ['b'], 1), change('b', ['a'], 2), change('z', [], 0), change('a', [], 0)]
  assert.deepEqual(names(dependencyOrder(input).ordered), ['a', 'z', 'b', 'c'])
  assert.deepEqual(names(dependencyOrder([...input].reverse()).ordered), ['a', 'z', 'b', 'c'])
  assert.deepEqual(dependencyOrder(input).unresolved, [])
  assert.deepEqual(names(input), ['c', 'b', 'z', 'a'])
})

test('cycles, self-cycles and downstream blocks never appear in the executable sequence', () => {
  const result = dependencyOrder([change('a', ['b']), change('b', ['a']), change('down', ['a']), change('self', ['self']), change('free')])
  assert.deepEqual(names(result.ordered), ['free'])
  assert.deepEqual(names(result.unresolved), ['a', 'b', 'down', 'self'])
  assert.ok(result.warnings.a.some(s => s.includes('Dependency cycle')))
  assert.ok(result.warnings.down.some(s => s.includes('Blocked by')))
})

test('unknown dependencies are exposed and archived prerequisites are satisfied', () => {
  const c = change('a', ['missing', 'archived'])
  c.ordering!.satisfied = ['archived']
  assert.deepEqual(dependencyOrder([c]).warnings.a, ['Unknown dependency: missing', 'Archived dependency (satisfied): archived'])
})

test('manual priority is validated, unique, and cannot contradict transitive dependencies', () => {
  for (const raw of ['0', '-1', '1.5', 'one', 'null', '1e2', '9007199254740992', '']) {
    assert.ok(parseManualOrder(`order: ${raw}`).warning)
  }
  assert.ok(parseManualOrder('order: 1\norder: 2').warning)
  assert.deepEqual(parseManualOrder('schema: spec-driven\norder: 2 # priority'), { order: 2, warning: null })
  assert.deepEqual(parseManualOrder('rules:\n  order: 4'), { order: null, warning: null })
  assert.deepEqual(names(dependencyOrder([change('a', [], 0, 2), change('b', [], 0, 1)]).ordered), ['b', 'a'])
  const duplicate = dependencyOrder([change('a', [], 0, 1), change('b', [], 0, 1)])
  assert.ok(duplicate.warnings.a.some(w => w.includes('Duplicate')))
  assert.ok(duplicate.warnings.b.some(w => w.includes('Duplicate')))
  const conflict = dependencyOrder([change('a', [], 0, 3), change('b', ['a']), change('c', ['b'], 0, 1)])
  assert.deepEqual(names(conflict.ordered), ['a', 'b', 'c'])
  assert.ok(conflict.warnings.c.some(w => w.includes('conflicts')))
})

test('favorites and ordering preferences are versioned, workspace-local and tolerate old data', () => {
  assert.ok(orderingKey('w1') !== orderingKey('w2'))
  const storage = new Map([[orderingKey('w1'), { mode: 'dependencies', favorites: ['a', 'a', 2] }]])
  assert.deepEqual(orderingPrefs(storage.get(orderingKey('w1'))), { mode: 'dependencies', favorites: ['a'] })
  assert.deepEqual(orderingPrefs(storage.get(orderingKey('w2'))), { mode: 'recent', favorites: [] })
  assert.deepEqual(orderingPrefs({ mode: 'future', favorites: null }), { mode: 'recent', favorites: [] })
})
