import { mkdir, mkdtemp, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { assert, test } from 'orca/testing'
import { countArchive, countSpecs, countTasks, fileToOpen, openableFiles, parseSpec, parseTasks, readArchive, readArchivedDetail, readChangeDetail, readChanges, readSpecList, specCapabilities } from './openspec'

test('counts checked and unchecked boxes', () => {
  const md = '## 1\n- [x] a\n- [ ] b\n  - [X] nested\n* [ ] star\ntext - [x] inline is ignored\n'
  assert.deepEqual(countTasks(md), { done: 2, total: 4 })
})

test('reads active changes, skips archive and reports artifacts', async () => {
  const root = await mkdtemp(join(tmpdir(), 'openspec-pulse-'))
  const changes = join(root, 'openspec', 'changes')
  await mkdir(join(changes, 'archive', 'old'), { recursive: true })
  await mkdir(join(changes, 'add-b', 'specs'), { recursive: true })
  await mkdir(join(changes, 'add-a'), { recursive: true })
  await writeFile(join(changes, 'add-b', 'proposal.md'), '# B')
  await writeFile(join(changes, 'add-b', 'tasks.md'), '- [x] one\n- [ ] two\n- [ ] three\n')
  await writeFile(join(changes, 'add-a', 'proposal.md'), '# A')
  await writeFile(join(changes, 'add-a', 'design.md'), '# A')
  await mkdir(join(changes, 'add-b', 'specs', 'x'), { recursive: true })
  await writeFile(join(changes, 'add-b', 'specs', 'x', 'spec.md'), '# X')
  // Whole seconds: some filesystems keep no sub-second mtime.
  const old = new Date(1_700_000_000_000)
  const newest = new Date(1_700_000_100_000)
  for (const file of ['add-a/proposal.md', 'add-a/design.md', 'add-b/proposal.md', 'add-b/tasks.md']) {
    await utimes(join(changes, file), old, old)
  }
  await utimes(join(changes, 'add-a', 'design.md'), newest, newest)
  await utimes(join(changes, 'add-b', 'specs', 'x', 'spec.md'), newest, newest)

  const result = await readChanges(root)
  assert.deepEqual(result, [
    { name: 'add-a', artifacts: ['proposal.md', 'design.md'], tasks: null, updatedAt: newest.getTime() },
    { name: 'add-b', artifacts: ['proposal.md', 'tasks.md', 'specs/'], tasks: { done: 1, total: 3 }, updatedAt: newest.getTime() }
  ])
  assert.equal(fileToOpen(result![0]), 'proposal.md')
  assert.equal(fileToOpen(result![1]), 'tasks.md')
})

test('answers null without openspec/changes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'openspec-pulse-'))
  assert.equal(await readChanges(root), null)
})

test('groups tasks under their headings', () => {
  const md = '# Tasks\n- [x] loose\n## 1. Read\n- [x] 1.1 a\n- [ ] 1.2 b\n## 2. Empty\n### 3. Ship\n* [X] 3.1 c\n'
  assert.deepEqual(parseTasks(md), [
    { title: '', tasks: [{ done: true, text: 'loose' }] },
    { title: '1. Read', tasks: [{ done: true, text: '1.1 a' }, { done: false, text: '1.2 b' }] },
    { title: '3. Ship', tasks: [{ done: true, text: '3.1 c' }] }
  ])
})

test('reads a change detail with specs and refuses unknown names', async () => {
  const root = await mkdtemp(join(tmpdir(), 'openspec-pulse-'))
  const change = join(root, 'openspec', 'changes', 'add-x')
  await mkdir(join(change, 'specs', 'billing'), { recursive: true })
  await mkdir(join(change, 'specs', 'no-spec'), { recursive: true })
  await mkdir(join(root, 'openspec', 'changes', 'archive', 'old'), { recursive: true })
  await writeFile(join(change, 'specs', 'billing', 'spec.md'), '# Billing')
  await writeFile(join(change, 'tasks.md'), '## 1. Do\n- [x] a\n- [ ] b\n')

  const detail = await readChangeDetail(root, 'add-x')
  assert.ok(detail && detail.updatedAt > 0)
  assert.deepEqual(detail, {
    updatedAt: detail.updatedAt,
    name: 'add-x',
    artifacts: ['tasks.md', 'specs/'],
    tasks: { done: 1, total: 2 },
    sections: [{ title: '1. Do', tasks: [{ done: true, text: 'a' }, { done: false, text: 'b' }] }],
    specs: ['specs/billing/spec.md']
  })
  assert.deepEqual(openableFiles(detail!), ['tasks.md', 'specs/billing/spec.md'])
  assert.equal(await readChangeDetail(root, '../..'), null)
  assert.equal(await readChangeDetail(root, 'archive'), null)
})

test('lists the archive newest first with name, date and final count', async () => {
  const root = await mkdtemp(join(tmpdir(), 'openspec-pulse-'))
  const archive = join(root, 'openspec', 'changes', 'archive')
  for (const folder of ['2026-01-01-old', '2026-11-26-new', 'loose']) await mkdir(join(archive, folder), { recursive: true })
  await writeFile(join(archive, '2026-11-26-new', 'tasks.md'), '- [x] a\n- [x] b\n- [ ] c\n')
  await mkdir(join(archive, '2026-11-26-new', 'specs', 'billing'), { recursive: true })
  await writeFile(join(archive, '2026-11-26-new', 'specs', 'billing', 'spec.md'), '# B')

  const list = await readArchive(root)
  assert.deepEqual(list.map((c) => [c.folder, c.name, c.date]), [
    ['2026-11-26-new', 'new', '2026-11-26'],
    ['2026-01-01-old', 'old', '2026-01-01'],
    ['loose', 'loose', null]
  ])
  assert.deepEqual(list[0].tasks, { done: 2, total: 3 })
  assert.equal(list[1].tasks, null)
  assert.equal(await countArchive(root), 3)
  assert.deepEqual(await readArchive(await mkdtemp(join(tmpdir(), 'openspec-pulse-'))), [])

  const detail = await readArchivedDetail(root, '2026-11-26-new')
  assert.ok(detail)
  assert.equal(detail.name, 'new')
  assert.equal(detail.date, '2026-11-26')
  assert.deepEqual(openableFiles(detail), ['tasks.md', 'specs/billing/spec.md'])
  assert.equal(await readArchivedDetail(root, '../x'), null)
  assert.equal(await readArchivedDetail(root, '..'), null)
  assert.equal(await readArchivedDetail(root, 'unlisted'), null)
})

test('lists main specs, nested paths included', async () => {
  const root = await mkdtemp(join(tmpdir(), 'openspec-pulse-'))
  const specs = join(root, 'openspec', 'specs')
  await mkdir(join(specs, 'billing'), { recursive: true })
  await mkdir(join(specs, 'identity', 'user-auth'), { recursive: true })
  await mkdir(join(specs, 'empty'), { recursive: true })
  await writeFile(join(specs, 'billing', 'spec.md'), '# Billing\n\n## Purpose\n\nCharge people.\nMore.\n\n## Requirements\n\n### Requirement: A\n### Requirement: B\n')
  await writeFile(join(specs, 'identity', 'user-auth', 'spec.md'), '### Requirement: Login\n')

  assert.deepEqual(await readSpecList(root), [
    { capability: 'billing', purpose: 'Charge people.', requirements: 2 },
    { capability: 'identity/user-auth', purpose: null, requirements: 1 }
  ])
  assert.equal(await countSpecs(root), 2)
  assert.deepEqual(await specCapabilities(await mkdtemp(join(tmpdir(), 'openspec-pulse-'))), [])
  assert.deepEqual(parseSpec('## Purpose\n## Requirements\n'), { purpose: null, requirements: 0 })
})
