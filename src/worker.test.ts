// Runs src/worker.ts's activate(orca) over a mock host whose focused workspace is a temp folder.
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rename, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { assert, mockHost, mountWorker, test } from 'orca/testing'

async function setup(extra: Record<string, unknown> = {}) {
  const path = await mkdtemp(join(tmpdir(), 'openspec-pulse-worker-'))
  const host = mockHost({
    results: {
      'workspace.readContext': { workspaceId: 'w1', branch: 'main', displayName: 'repo', terminals: [] },
      'workspace.list': {
        workspaces: [{ id: 'w1', kind: 'folder', name: 'repo', path, branch: null, hostId: 'local' }],
        truncated: false
      },
      'editor.open': { opened: true },
      'statusBar.update': { ok: true },
      ...extra
    }
  })
  // Orca launched from the Dock has this PATH: init must still find openspec.
  process.env.PATH = '/usr/bin:/bin:/usr/sbin:/sbin'
  const worker = await mountWorker(await import('./worker'), { host })
  return { host, worker, path }
}

test('initializes OpenSpec, then lists and opens only known files', async () => {
  if (!existsSync(join(homedir(), '.local', 'bin', 'openspec'))) return // needs the openspec CLI
  const { host, worker } = await setup()
  try {
    assert.deepEqual(await worker.request('changes.list'), { status: 'no-openspec', workspace: 'repo' })
    assert.deepEqual(await worker.request('openspec.init'), { status: 'ok', workspace: 'repo', changes: [], archived: 0, specs: 0 })

    assert.equal(await worker.request('changes.detail', { name: '..' }), null)
    assert.deepEqual(await worker.request('changes.open', { name: 'archive', file: 'tasks.md' }), { opened: false })
    assert.equal(host.callsOf('editor.open').length, 0)

    await assert.rejects(worker.request('agent.run', { action: 'apply', change: '../x' }))
    await assert.rejects(worker.request('agent.run', { action: 'propose', prompt: '' }))
    assert.deepEqual(worker.refusals, [])
  } finally {
    await worker.deactivate() // closes the watcher, or the run never ends
  }
})

test('never resolves an openspec planted inside the workspace', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'openspec-pulse-plant-'))
  await writeFile(join(workspace, 'openspec'), '#!/bin/sh\necho planted\n', { mode: 0o755 })
  const saved = process.env.PATH
  process.env.PATH = `.:${workspace}`
  try {
    const { resolveOpenspec } = await import('./worker')
    const found = resolveOpenspec(workspace)
    assert.ok(found === null || !found.startsWith(workspace), `resolved ${found}`)
  } finally {
    process.env.PATH = saved
  }
})

test('sends the command to an idle Claude Code terminal instead of opening a chat', async () => {
  const { host, worker } = await setup({
    'agents.list': { agents: [{ terminalId: 't9', title: null, agent: 'claude', state: 'done', stateStartedAt: 0 }] },
    'terminal.sendText': { accepted: true },
    'terminal.focus': { focused: true }
  })
  try {
    const answer = await worker.request('agent.run', { action: 'propose', prompt: 'Add CSV\nexport' })
    assert.deepEqual(answer, { surface: 'open-terminal' })
    assert.deepEqual(host.callsOf('terminal.sendText'), [
      { terminalId: 't9', text: '/openspec-propose Add CSV export', enter: true }
    ])
    assert.deepEqual(host.callsOf('terminal.focus'), [{ terminalId: 't9' }])
    assert.deepEqual(worker.refusals, [])
  } finally {
    await worker.deactivate()
  }
})

async function writeChange(root: string, name: string, tasks: string): Promise<void> {
  const dir = join(root, 'openspec', 'changes', name)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'tasks.md'), tasks)
}

test('keeps the status bar item on the focused workspace, panel closed', async () => {
  const { host, worker, path } = await setup()
  const last = () => host.callsOf('statusBar.update').at(-1)
  try {
    await worker.request('changes.list')
    assert.deepEqual(last(), { id: 'summary', visible: false })

    await writeChange(path, 'add-x', '- [x] a\n- [ ] b\n')
    await worker.emit('workspace.changed', { context: { workspaceId: 'w1', branch: 'main', displayName: 'repo', terminals: [] } })
    assert.deepEqual(last(), {
      id: 'summary',
      visible: true,
      text: '1 change · 1/2',
      tone: 'accent',
      tooltip: 'OpenSpec · repo\nadd-x 1/2'
    })

    // The same summary again is not sent twice.
    const sent = host.callsOf('statusBar.update').length
    await worker.emit('workspace.changed', { context: { workspaceId: 'w1', branch: 'main', displayName: 'repo', terminals: [] } })
    assert.equal(host.callsOf('statusBar.update').length, sent)

    // Switching to another workspace sends its summary.
    const other = await mkdtemp(join(tmpdir(), 'openspec-pulse-other-'))
    await writeChange(other, 'fix-y', '- [x] a\n')
    host.respond('workspace.readContext', { workspaceId: 'w2', branch: 'main', displayName: 'other', terminals: [] })
    host.respond('workspace.list', {
      workspaces: [{ id: 'w2', kind: 'folder', name: 'other', path: other, branch: null, hostId: 'local' }],
      truncated: false
    })
    await worker.emit('workspace.changed', { context: { workspaceId: 'w2', branch: 'main', displayName: 'other', terminals: [] } })
    assert.deepEqual(last(), {
      id: 'summary',
      visible: true,
      text: '1 change · 1/1',
      tone: 'success',
      tooltip: 'OpenSpec · other\nfix-y 1/1'
    })
    assert.deepEqual(worker.refusals, [])
  } finally {
    await worker.deactivate()
  }
})

test('lists the archive and specs, opens only listed files and counts them', async () => {
  const { host, worker, path } = await setup()
  try {
    await writeChange(path, 'add-x', '- [ ] a\n')
    const archived = join(path, 'openspec', 'changes', 'archive', '2026-11-26-old')
    await mkdir(archived, { recursive: true })
    await writeFile(join(archived, 'tasks.md'), '- [x] a\n')
    await mkdir(join(path, 'openspec', 'specs', 'billing'), { recursive: true })
    await writeFile(join(path, 'openspec', 'specs', 'billing', 'spec.md'), '## Purpose\nCharge.\n### Requirement: A\n')

    const list = await worker.request('changes.list')
    assert.ok(list.status === 'ok' && list.archived === 1 && list.specs === 1)
    assert.deepEqual((await worker.request('archive.list')).map((c) => c.folder), ['2026-11-26-old'])
    assert.equal((await worker.request('archive.detail', { folder: '2026-11-26-old' }))?.name, 'old')
    assert.deepEqual(await worker.request('specs.list'), [{ capability: 'billing', purpose: 'Charge.', requirements: 1 }])

    assert.deepEqual(await worker.request('changes.open', { name: '2026-11-26-old', archived: true }), { opened: true })
    assert.deepEqual(await worker.request('specs.open', { capability: 'billing' }), { opened: true })
    assert.deepEqual(host.callsOf('editor.open'), [
      { workspaceId: 'w1', path: join('openspec', 'changes', 'archive', '2026-11-26-old', 'tasks.md') },
      { workspaceId: 'w1', path: join('openspec', 'specs', 'billing', 'spec.md') }
    ])

    const before = host.callsOf('editor.open').length
    assert.equal(await worker.request('archive.detail', { folder: '../add-x' }), null)
    assert.deepEqual(await worker.request('changes.open', { name: '../add-x', archived: true }), { opened: false })
    assert.deepEqual(await worker.request('changes.open', { name: 'add-x', archived: true }), { opened: false })
    assert.deepEqual(await worker.request('specs.open', { capability: '../changes/add-x' }), { opened: false })
    assert.equal(host.callsOf('editor.open').length, before)
    assert.deepEqual(worker.refusals, [])
  } finally {
    await worker.deactivate()
  }
})

test('posts changes.changed when a change moves into the archive', async () => {
  const { worker, path } = await setup()
  try {
    await writeChange(path, 'add-x', '- [x] a\n')
    const before = await worker.request('changes.list')
    assert.ok(before.status === 'ok' && before.changes.length === 1 && before.archived === 0)

    const archive = join(path, 'openspec', 'changes', 'archive')
    await mkdir(archive, { recursive: true })
    await rename(join(path, 'openspec', 'changes', 'add-x'), join(archive, '2026-11-26-add-x'))
    // Past the 300 ms debounce; polls so a slow watcher does not make the test flaky.
    for (let i = 0; i < 40 && !worker.posts.some((p) => p.event === 'changes.changed'); i++) {
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    assert.ok(worker.posts.some((p) => p.event === 'changes.changed'))

    const after = await worker.request('changes.list')
    assert.ok(after.status === 'ok' && after.changes.length === 0 && after.archived === 1)
  } finally {
    await worker.deactivate()
  }
})
