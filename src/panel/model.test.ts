import { assert, test } from 'orca/testing'
import { agentRunInput, archiveDestination } from './model'

const options = { workspaceId: 'w1', profile: 'codex-skills' as const, model: null, target: 'auto' as const }

test('archive confirmation names a concrete destination using the local calendar date', () => {
  assert.equal(archiveDestination('add-board', new Date(2026, 10, 27, 12)), 'openspec/changes/archive/2026-11-27-add-board')
})

test('whole-change requests omit absent task fields and survive the JSON bridge unchanged', () => {
  for (const action of ['continue', 'apply', 'verify', 'archive'] as const) {
    const input = agentRunInput({ action, change: 'run-individual-tasks' }, options)
    assert.deepEqual(input, { action, change: 'run-individual-tasks', ...options })
    assert.deepEqual(input, JSON.parse(JSON.stringify(input)))
    assert.equal(Object.hasOwn(input, 'task'), false)
  }
})

test('free prompts omit absent changes and tasks, including explicitly undefined values', () => {
  for (const action of ['propose', 'explore'] as const) {
    const input = agentRunInput({ action, change: undefined }, { ...options, prompt: 'Investigate caching' })
    assert.deepEqual(input, { action, prompt: 'Investigate caching', ...options })
    assert.deepEqual(input, JSON.parse(JSON.stringify(input)))
  }
  const input = agentRunInput({ action: 'explore' }, { ...options, prompt: undefined })
  assert.deepEqual(input, { action: 'explore', ...options })
})

test('task requests send only identity and bind the original workspace', () => {
  const input = agentRunInput({ action: 'task', change: 'add-x', workspaceId: 'original', task: {
    section: 1, position: 2, fingerprint: 'hash', sectionTitle: 'Ship', text: 'Selected task'
  } }, options)
  assert.deepEqual(input, { action: 'task', change: 'add-x', task: { section: 1, position: 2, fingerprint: 'hash' }, ...options, workspaceId: 'original' })
  assert.deepEqual(input, JSON.parse(JSON.stringify(input)))
})
