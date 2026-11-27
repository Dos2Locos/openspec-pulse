import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { assert, test } from 'orca/testing'
import { CONFIG_MAX_BYTES, parseWorkflow, resumeParagraph } from './config'
import { readWorkflow } from './config-reader'
import { buildPrompt } from './commands'
import { readChangeDetail, readChanges } from './openspec'
import { changeState, nextStep } from './state'

test('validates configuration atomically and names invalid placeholders', () => {
  assert.deepEqual(parseWorkflow('{"schemaVersion":1}'), { schemaVersion: 1 })
  for (const value of [null, [], {}, { schemaVersion: 2 }, { schemaVersion: 1, typo: true },
    { schemaVersion: 1, requiredArtifacts: ['../secret'] }, { schemaVersion: 1, requiredArtifacts: null },
    { schemaVersion: 1, resumePrefixes: [''] }, { schemaVersion: 1, resumePrefixes: ['Next:\n'] },
    { schemaVersion: 1, commands: { shell: 'ls' } }, { schemaVersion: 1, commands: [] },
    { schemaVersion: 1, commands: { apply: 'one\ntwo' } }, { schemaVersion: 1, commands: { apply: 'one\ttwo' } },
    { schemaVersion: 1, commands: { apply: 'one\u001btwo' } }, { schemaVersion: 1, commands: { apply: '{{change}}' } },
    { schemaVersion: 1, commands: { propose: '{change}' } }, { schemaVersion: 1, commands: { apply: '{task}' } }]) {
    assert.throws(() => parseWorkflow(JSON.stringify(value)))
  }
  assert.throws(() => parseWorkflow('{bad'))
  assert.throws(() => parseWorkflow('{"schemaVersion":1,"commands":{"apply":"run {secret}"}}'), /secret/)
})

test('extracts literal continuation paragraphs without executing fenced examples', () => {
  const md = '```\nNext: example\n```\n\nSiguiente: revisar `billing`.\nContinuar aquí.\n\n- [ ] Task'
  assert.equal(resumeParagraph(md), null)
  assert.equal(resumeParagraph(md, ['Siguiente:']), 'Siguiente: revisar `billing`.\nContinuar aquí.')
  assert.equal(resumeParagraph('Next.*: literal\n## heading', ['Next.*:']), 'Next.*: literal')
  assert.equal(resumeParagraph('NextXX: no match', ['Next.*:']), null)
})

test('reads a bounded optional file, rejects whole invalid configs and fingerprints root and content', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pulse-config-'))
  await mkdir(join(root, 'openspec'))
  const path = join(root, 'openspec', 'pulse.json')
  assert.deepEqual(await readWorkflow(root), { config: null, fingerprint: null, error: null })
  await writeFile(path, '{"schemaVersion":1,"requiredArtifacts":["design.md"],"typo":true}')
  const invalid = await readWorkflow(root)
  assert.equal(invalid.config, null)
  assert.match(invalid.error!, /typo/)
  await writeFile(path, '{"schemaVersion":1}' + ' '.repeat(CONFIG_MAX_BYTES))
  assert.match((await readWorkflow(root)).error!, /64 KiB/)
  const text = '{"schemaVersion":1}' + ' '.repeat(CONFIG_MAX_BYTES - 19)
  assert.equal(Buffer.byteLength(text), CONFIG_MAX_BYTES)
  await writeFile(path, text)
  const valid = await readWorkflow(root)
  assert.ok(valid.fingerprint)
  assert.equal(valid.error, null)
  await writeFile(path, text.trim())
  assert.notEqual((await readWorkflow(root)).fingerprint, valid.fingerprint)
  const other = await mkdtemp(join(tmpdir(), 'pulse-config-other-'))
  await mkdir(join(other, 'openspec'))
  await writeFile(join(other, 'openspec', 'pulse.json'), text)
  assert.notEqual((await readWorkflow(other)).fingerprint, valid.fingerprint)
})

test('required artifacts override completed tasks in list and detail only when explicit', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pulse-config-state-'))
  const dir = join(root, 'openspec', 'changes', 'done')
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'tasks.md'), '- [x] Complete\n\nSiguiente: revisar\ncon el equipo.\n')
  assert.equal(changeState((await readChanges(root))![0]), 'done')
  const path = join(root, 'openspec', 'pulse.json')
  await writeFile(path, JSON.stringify({ schemaVersion: 1, requiredArtifacts: ['design.md'], resumePrefixes: ['Siguiente:'] }))
  const change = (await readChanges(root))![0]
  const detail = (await readChangeDetail(root, 'done'))!
  assert.equal(changeState(change), 'drafting')
  assert.deepEqual(change.missingArtifacts, ['design.md'])
  assert.equal(nextStep(change).action, 'continue')
  assert.equal(detail.resume, 'Siguiente: revisar\ncon el equipo.')
  await writeFile(join(dir, 'design.md'), '# Design')
  assert.equal(changeState((await readChanges(root))![0]), 'done')
  await writeFile(join(dir, 'tasks.md'), '- [x] Done\n- [ ] Pending')
  assert.equal(changeState((await readChangeDetail(root, 'done'))!), 'in-progress')
  await writeFile(path, '{broken')
  assert.equal(changeState((await readChanges(root))![0]), 'in-progress')
  assert.equal((await readChangeDetail(root, 'done'))?.missingArtifacts, undefined)
})

test('renders templates literally without recursive substitution and preserves task scope', () => {
  const config = parseWorkflow(JSON.stringify({ schemaVersion: 1, commands: {
    apply: '/custom {change}', propose: '/propose {prompt}', task: '/custom {change}: {task}'
  } }))
  assert.deepEqual(buildPrompt('codex-skills', 'apply', { change: 'add-x' }, config), { prompt: '/custom add-x' })
  assert.deepEqual(buildPrompt('codex-skills', 'propose', { prompt: 'a {change} $(literal)' }, config), { prompt: '/propose a {change} $(literal)' })
  assert.deepEqual(buildPrompt('codex-skills', 'verify', { change: 'add-x' }, config), { prompt: '$openspec-verify-change add-x' })
  const task = buildPrompt('codex-skills', 'task', { change: 'add-x', task: { sectionTitle: 'One', section: 0, position: 0, text: 'Only this' } }, config)
  assert.ok('prompt' in task && task.prompt.startsWith('/custom add-x: Only this\nWork ONLY'))
})
