import { assert, test } from 'orca/testing'
import { mkdtemp, mkdir, writeFile, symlink, rm, link, realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { aggregateSpend, parseRun, RUN_MAX_BYTES, RUN_MAX_LINES } from './spend'
import { readRunFile, readSpend } from './spend-reader'
import { parseWorkflow } from './config'
import type { OpenSpecRoot } from './stores'

test('run validation distinguishes unknown cost and zero and rejects malformed numbers', () => {
  for (const line of ['no json', '[]', '{}', '{"costUsd":-1}', '{"costUsd":1e999}', '{"inputTokens":1.5}', '{"outputTokens":"2"}', '{"costUsd":null}', '{"model":3,"costUsd":1}']) assert.equal(parseRun(line), null)
  assert.deepEqual(parseRun('{"costUsd":0}'), { costUsd: 0 })
  assert.deepEqual(parseRun('{"inputTokens":0}'), { inputTokens: 0 })
  for (const path of ['../outside', '/tmp/private', 'x/../../z', 'C:/private', 'x\\z']) assert.throws(() => parseWorkflow(JSON.stringify({ schemaVersion: 1, runs: { file: path } })))
  assert.equal(parseWorkflow('{"schemaVersion":1,"runs":false}').runs, false)
})

test('aggregates deduplicate files and IDs, report divergence, and group absent metadata honestly', () => {
  const lines = ['{"id":"a","costUsd":0,"at":"2026-11-27T09:00:00Z"}', '{"id":"a","costUsd":2}', '{"inputTokens":12,"at":"bad"}', '{"costUsd":0.12,"task":"2.1","model":"model"}', 'broken']
  const result = aggregateSpend('root', [{ identity: 'one', lines, truncated: true }, { identity: 'same-inode', lines: [lines[0]], truncated: false }, { identity: 'one', lines, truncated: false }])
  assert.equal(result.total.costUsd, 0.12)
  assert.equal(result.total.knownCosts, 2)
  assert.equal(result.total.unknownCosts, 1)
  assert.equal(result.byMonth['__pulse_no_date__'].events, 2)
  assert.equal(result.byMonth['2026-11'].events, 1)
  assert.equal(result.byTask['__pulse_no_task__'].inputTokens, 12)
  assert.equal(result.diagnostics.duplicates, 2)
  assert.equal(result.diagnostics.conflicts, 1)
  assert.equal(result.diagnostics.discarded, 1)
  assert.equal(result.diagnostics.withoutId, 2)
})

test('bounded tail, escaped symlinks, archived files and shared store identities', async () => {
  const path = await realpath(await mkdtemp(join(tmpdir(), 'pulse-spend-')))
  const outside = await mkdtemp(join(tmpdir(), 'pulse-spend-outside-'))
  const root: OpenSpecRoot = { workspacePath: path, dataPath: path, kind: 'store', storeId: 'test', prefixes: [], fingerprint: 'x', diagnostics: [] }
  try {
    await mkdir(join(path, 'openspec/changes/a'), { recursive: true })
    await mkdir(join(path, 'openspec/changes/archive/2026-11-27-old'), { recursive: true })
    await mkdir(join(path, 'logs'))
    await writeFile(join(path, 'openspec/changes/a/runs.jsonl'), '{"id":"a","costUsd":1}\n')
    await writeFile(join(path, 'openspec/changes/archive/2026-11-27-old/runs.jsonl'), '{"id":"a","costUsd":1}\n{"outputTokens":2}\n')
    await link(join(path, 'openspec/changes/a/runs.jsonl'), join(path, 'logs/copy.jsonl'))
    const config = { file: 'runs.jsonl', folders: ['logs', 'logs'] }
    const one = await readSpend(root, config)
    const two = await readSpend({ ...root, workspacePath: outside }, config)
    assert.deepEqual(one, two)
    assert.equal(one.total.costUsd, 1)
    assert.equal(one.total.events, 2)
    assert.equal(one.diagnostics.files, 2)
    await writeFile(join(outside, 'secret.jsonl'), '{"costUsd":900}\n')
    await symlink(join(outside, 'secret.jsonl'), join(path, 'logs/escape.jsonl'))
    assert.equal((await readSpend(root, config)).diagnostics.excluded, 2)
    await assert.rejects(readRunFile(path, join(path, 'logs/escape.jsonl')), /Symbolic/)
    await writeFile(join(path, 'large.jsonl'), '{"inputTokens":1}\n'.repeat(RUN_MAX_LINES + 10))
    const tail = await readRunFile(path, join(path, 'large.jsonl'))
    assert.equal(tail.lines.length, RUN_MAX_LINES); assert.equal(tail.truncated, true)
    await writeFile(join(path, 'large.jsonl'), 'x'.repeat(RUN_MAX_BYTES + 10) + '\n{"costUsd":2}\n')
    const bytes = await readRunFile(path, join(path, 'large.jsonl'))
    assert.equal(bytes.truncated, true); assert.deepEqual(bytes.lines, ['{"costUsd":2}'])
    assert.equal((await readSpend(root, false)).enabled, false)
  } finally { await rm(path, { recursive: true, force: true }); await rm(outside, { recursive: true, force: true }) }
})

test('filtered store folders remain unattributed and deduplicate against scoped changes', async () => {
  const path = await realpath(await mkdtemp(join(tmpdir(), 'pulse-spend-scope-')))
  const root: OpenSpecRoot = { workspacePath: path, dataPath: path, kind: 'store', storeId: 'test', prefixes: ['app-'], fingerprint: 'x', diagnostics: [] }
  try {
    await mkdir(join(path, 'openspec/changes/app-one'), { recursive: true })
    await mkdir(join(path, 'openspec/changes/other-two'), { recursive: true })
    await mkdir(join(path, 'logs'))
    await writeFile(join(path, 'openspec/changes/app-one/runs.jsonl'), '{"id":"known","costUsd":1}\n')
    await writeFile(join(path, 'openspec/changes/other-two/runs.jsonl'), '{"costUsd":999}\n')
    await writeFile(join(path, 'logs/extra.jsonl'), '{"id":"known","costUsd":1}\n{"id":"extra","costUsd":2}\n')
    const result = await readSpend(root, { file: 'runs.jsonl', folders: ['logs'] })
    assert.equal(result.total.costUsd, 1)
    assert.equal(result.unattributed?.total.costUsd, 2)
    assert.equal(result.unattributed?.diagnostics.duplicates, 1)
    const { readSpendSources, combineSpend } = await import('./spend-reader')
    const config = { file: 'runs.jsonl', folders: ['logs'] }
    const one = await readSpendSources(root, config)
    const two = await readSpendSources({ ...root, workspacePath: '/another-worktree' }, config)
    const combined = combineSpend([one, two])
    assert.equal(combined.total.costUsd, 1)
    assert.equal(combined.unattributed?.total.costUsd, 2)
    // Overlapping scopes and an unfiltered root still deduplicate file and event identities.
    const unfiltered = await readSpendSources({ ...root, prefixes: [] }, config)
    assert.equal(combineSpend([one, unfiltered]).total.costUsd, 1002)
    const foreign = { ...one, files: one.files.map(file => ({ ...file, namespace: '/different-root', identity: file.identity + ':other' })) }
    assert.equal(combineSpend([one, foreign]).total.costUsd, 2)
  } finally { await rm(path, { recursive: true, force: true }) }
})

test('a real model or task matching a missing-data label remains literal in presentation metadata', () => {
  const result = aggregateSpend('root', [{ identity: 'real-label', lines: [JSON.stringify({ costUsd: 1, task: '__pulse_no_task__', model: '__pulse_no_model__' })], truncated: false }])
  assert.deepEqual(result.literalGroups, { byTask: ['__pulse_no_task__'], byModel: ['__pulse_no_model__'] })
  assert.equal(result.byModel['__pulse_no_model__'].costUsd, 1)
})
