import { mkdir, mkdtemp, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { assert, test } from 'orca/testing'
import { countArchive, countSpecs, countTasks, fileToOpen, openableFiles, parseSpec, parseTasks, readArchive, readArchivedDetail, readChangeDetail, readChanges, readSpecList, resolveTask, specCapabilities } from './openspec'

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
  assert.deepEqual(result?.map(({ ordering, ...change }) => change), [
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

test('resolves duplicate tasks by section and position, bound to the exact file and root', async () => {
  const root = await mkdtemp(join(tmpdir(), 'openspec-pulse-tasks-'))
  const dir = join(root, 'openspec', 'changes', 'add-x')
  await mkdir(dir, { recursive: true })
  const markdown = '## Same\n- [ ] duplicate\n- [ ] duplicate\n## Same\n- [ ] duplicate\n- [x] done\n'
  await writeFile(join(dir, 'tasks.md'), markdown)
  const detail = await readChangeDetail(root, 'add-x')
  const selection = { section: 1, position: 0, fingerprint: detail!.tasksFingerprint! }
  assert.deepEqual(resolveTask(detail, selection), { sectionTitle: 'Same', text: 'duplicate', section: 1, position: 0 })
  assert.deepEqual(resolveTask(detail, { ...selection, section: 0, position: 1 }), { sectionTitle: 'Same', text: 'duplicate', section: 0, position: 1 })
  for (const invalid of [{ section: -1 }, { position: 0.5 }, { position: 2 }, { position: 1 }, { fingerprint: '' }]) {
    assert.equal(resolveTask(detail, { ...selection, ...invalid }), null)
  }
  assert.equal(resolveTask(null, selection), null)
  for (const updated of [markdown + '\n', markdown.replace('## Same', '## Moved'), markdown.replace('- [ ] duplicate', '- [x] duplicate'), '- [ ] duplicate\n']) {
    await writeFile(join(dir, 'tasks.md'), updated)
    assert.equal(resolveTask(await readChangeDetail(root, 'add-x'), selection), null)
  }
  const other = await mkdtemp(join(tmpdir(), 'openspec-pulse-tasks-'))
  await mkdir(join(other, 'openspec', 'changes', 'add-x'), { recursive: true })
  await writeFile(join(other, 'openspec', 'changes', 'add-x', 'tasks.md'), markdown)
  assert.equal(resolveTask(await readChangeDetail(other, 'add-x'), selection), null)
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
    ordering: detail.ordering,
    updatedAt: detail.updatedAt,
    tasksFingerprint: detail.tasksFingerprint,
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


test('reads dependency metadata and refreshes edits without rewriting project files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pulse-ordering-'))
  const dir = join(root, 'openspec', 'changes', 'dependent')
  await mkdir(dir, { recursive: true })
  await mkdir(join(root, 'openspec', 'changes', 'archive', '2026-01-01-base'), { recursive: true })
  await writeFile(join(dir, 'proposal.md'), 'Depende de: `base`, `missing`')
  const yaml = 'schema: spec-driven\ncreated: 2026-01-02\norder: 2\n'
  await writeFile(join(dir, '.openspec.yaml'), yaml)
  const first = (await readChanges(root))![0].ordering!
  assert.deepEqual(first.dependencies, ['base', 'missing'])
  assert.deepEqual(first.satisfied, ['base'])
  assert.equal(first.createdAt, Date.parse('2026-01-02'))
  assert.equal(first.order, 2)
  await writeFile(join(dir, 'proposal.md'), 'Dependencies: `different`')
  await writeFile(join(dir, '.openspec.yaml'), 'order: wrong')
  const next = (await readChanges(root))![0].ordering!
  assert.deepEqual(next.dependencies, ['different'])
  assert.equal(next.order, null)
  assert.ok(next.warnings.length > 0)
})

test('detail and main specs share full capability paths beyond three folders', async () => {
  const root = await mkdtemp(join(tmpdir(), 'openspec-pulse-deep-'))
  const capability = 'billing/invoices/domestic/standard'
  for (const base of ['changes/add-x/specs', 'specs']) {
    const dir = join(root, 'openspec', base, capability)
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'spec.md'), '# Spec')
  }
  assert.deepEqual((await readChangeDetail(root, 'add-x'))?.specs, [`specs/${capability}/spec.md`])
  assert.deepEqual(await specCapabilities(root), [capability])
})
