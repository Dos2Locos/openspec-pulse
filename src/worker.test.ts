import { AgentUsageReader } from './usage-reader'
import { StoreReader } from './store-reader'
import { storeScopeKey } from './stores'
import { GithubDelivery } from './github'
// Runs src/worker.ts's activate(orca) over a mock host whose focused workspace is a temp folder.
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile, realpath } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { assert, mockHost, mountWorker, test } from 'orca/testing'
import type { ChangeDetail } from './protocol'

async function setup(extra: Record<string, unknown> = {}, delivery?: GithubDelivery, prepare?: (path: string) => Promise<void>, stores?: StoreReader, usage?: AgentUsageReader) {
  const path = await mkdtemp(join(tmpdir(), 'openspec-pulse-worker-'))
  await prepare?.(path)
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
  const module = await import('./worker')
  let storage!: import('orca/worker').OrcaWorkerApi['storage']
  if (delivery) { const get = delivery.get.bind(delivery); delivery.get = input => get({ ...input, binary: '/mock/gh' }) }
  const worker = await mountWorker({ ...module, default: api => { storage = api.storage; module.default(api, delivery, stores, usage) } }, { host })
  return { host, worker, path, storage }
}

test('board marker is ignored, bound to the workspace, and never overwrites unknown files', async () => {
  const { worker, host, path } = await setup()
  try {
    const git = promisify(execFile)
    await git('/usr/bin/git', ['init', '-q', path])
    await assert.rejects(worker.request('board.open', { workspaceId: 'other' }), /focused local workspace/)
    await assert.rejects(worker.request('board.open', { workspaceId: 'w1' }), /Ignore .orca/)
    assert.equal(existsSync(join(path, '.orca')), false)
    await writeFile(join(path, '.gitignore'), '.orca/\n')
    await worker.request('board.open', { workspaceId: 'w1' })
    assert.deepEqual(host.callsOf('editor.open'), [{ workspaceId: 'w1', path: '.orca/openspec.pulse-board' }])
    assert.equal(JSON.parse(await readFile(join(path, '.orca/openspec.pulse-board'), 'utf8')).workspaceId, 'w1')
    await writeFile(join(path, '.orca/openspec.pulse-board'), '{"schemaVersion":2,"workspaceId":"w1","future":true}')
    await assert.rejects(worker.request('board.open', { workspaceId: 'w1' }), /preserved/)
    assert.equal(JSON.parse(await readFile(join(path, '.orca/openspec.pulse-board'), 'utf8')).future, true)
    await rm(join(path, '.orca'), { recursive: true })
    const outside = await mkdtemp(join(tmpdir(), 'pulse-board-outside-'))
    await symlink(outside, join(path, '.orca'))
    await assert.rejects(worker.request('board.open', { workspaceId: 'w1' }), /symbolic link/)
    assert.equal(existsSync(join(outside, 'openspec.pulse-board')), false)
    assert.equal(host.callsOf('editor.open').length, 1)
    await rm(outside, { recursive: true })
  } finally { await worker.deactivate(); await rm(path, { recursive: true, force: true }) }
})

test('artifact preview returns inert source only for known real local artifacts, including archives', async () => {
  const { worker, host, path } = await setup()
  try {
    const dir = join(path, 'openspec/changes/add-preview')
    await mkdir(dir, { recursive: true })
    const markdown = '# Proposal\n<script>window.pwned=true</script>\n[bad](javascript:alert)'
    await writeFile(join(dir, 'proposal.md'), markdown)
    const input = { workspaceId: 'w1', name: 'add-preview', file: 'proposal.md' }
    assert.deepEqual(await worker.request('artifacts.read', input), { file: 'proposal.md', markdown })
    for (const file of ['../secret.md', '/etc/passwd', 'unknown.md']) assert.equal(await worker.request('artifacts.read', { ...input, file }), null)
    await assert.rejects(worker.request('artifacts.read', { ...input, workspaceId: 'other' }))
    const archived = join(path, 'openspec/changes/archive/2026-11-27-add-preview')
    await mkdir(archived, { recursive: true })
    await writeFile(join(archived, 'proposal.md'), markdown)
    assert.deepEqual(await worker.request('artifacts.read', { ...input, name: '2026-11-27-add-preview', archived: true }), { file: 'proposal.md', markdown })
    await writeFile(join(dir, 'proposal.md'), 'x'.repeat(48_001))
    await assert.rejects(worker.request('artifacts.read', input), /preview limit/)
    await rm(join(dir, 'proposal.md'))
    await symlink(join(archived, 'proposal.md'), join(dir, 'proposal.md'))
    assert.equal(await worker.request('artifacts.read', input), null)
    assert.equal(host.callsOf('editor.open').length, 0)
    assert.equal(host.callsOf('terminal.sendText').length, 0)
  } finally { await worker.deactivate(); await rm(path, { recursive: true, force: true }) }
})

test('board coalesces no duplicate open and rejects a workspace switch before creating its marker', async () => {
  const { worker, host, path } = await setup()
  try {
    await promisify(execFile)('/usr/bin/git', ['init', '-q', path])
    await writeFile(join(path, '.gitignore'), '.orca/\n')
    const opens = await Promise.allSettled([worker.request('board.open', { workspaceId: 'w1' }), worker.request('board.open', { workspaceId: 'w1' })])
    assert.equal(opens.filter(result => result.status === 'fulfilled').length, 1)
    assert.equal(host.callsOf('editor.open').length, 1)
    await rm(join(path, '.orca'), { recursive: true })
    let reads = 0
    host.respond('workspace.readContext', () => ({ workspaceId: ++reads === 1 ? 'w1' : 'w2', branch: 'main', displayName: 'repo', terminals: [] }))
    await assert.rejects(worker.request('board.open', { workspaceId: 'w1' }), /workspace changed/)
    assert.equal(existsSync(join(path, '.orca/openspec.pulse-board')), false)
    assert.equal(host.callsOf('editor.open').length, 1)
  } finally { await worker.deactivate(); await rm(path, { recursive: true, force: true }) }
})

test('preview discards a workspace changed during the read and refreshes an edited artifact', async () => {
  const { worker, host, path } = await setup()
  try {
    await writeChange(path, 'one', '- [ ] pending')
    const file = join(path, 'openspec/changes/one/tasks.md')
    const input = { workspaceId: 'w1', name: 'one', file: 'tasks.md' }
    assert.ok((await worker.request('artifacts.read', input))?.markdown.includes('[ ]'))
    await writeFile(file, '- [x] finished')
    assert.ok((await worker.request('artifacts.read', input))?.markdown.includes('[x]'))
    let reads = 0
    host.respond('workspace.readContext', () => ({ workspaceId: ++reads === 1 ? 'w1' : 'w2', branch: 'main', displayName: 'repo', terminals: [] }))
    await assert.rejects(worker.request('artifacts.read', input), /workspace.*changed/)
    assert.equal(host.callsOf('editor.open').length, 0)
    assert.equal(host.callsOf('terminal.sendText').length, 0)
  } finally { await worker.deactivate(); await rm(path, { recursive: true, force: true }) }
})

test('panel and board can browse concurrently and refresh the same progress after a file event', async () => {
  const { worker, path } = await setup({}, undefined, path => writeChange(path, 'one', '- [ ] pending'))
  try {
    await worker.request('changes.list') // Establish the single shared watcher.
    const request = () => worker.request('worktrees.browse', { focusedWorkspaceId: 'w1', scope: 'focused' })
    const initial = await Promise.all([request(), request()])
    assert.deepEqual(initial[0], initial[1])
    const posted = worker.posts.length
    await writeFile(join(path, 'openspec/changes/one/tasks.md'), '- [x] finished')
    for (let i = 0; i < 40 && worker.posts.length === posted; i++) await new Promise(resolve => setTimeout(resolve, 50))
    assert.ok(worker.posts.slice(posted).some(post => post.event === 'changes.changed'))
    const latest = await Promise.all([request(), request()])
    assert.deepEqual(latest[0], latest[1])
    assert.ok(latest.every(snapshot => snapshot.list.status === 'ok' && snapshot.list.changes[0].tasks?.done === 1))
  } finally { await worker.deactivate(); await rm(path, { recursive: true, force: true }) }
})

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
    assert.deepEqual(answer, { surface: 'open-terminal', agent: 'claude' })
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
      text: 'OpenSpec · 1 · 1/2',
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
      text: 'OpenSpec · 1 · 1/1',
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

const agentRows = [
  { terminalId: 'c-done', title: null, agent: 'claude', state: 'done', stateStartedAt: 1 },
  { terminalId: 'c-work', title: null, agent: 'claude', state: 'working', stateStartedAt: 1 },
  { terminalId: 'x-done', title: null, agent: 'codex', state: 'done', stateStartedAt: 1 }
]
const sendHost = { 'agents.list': { agents: agentRows }, 'terminal.sendText': { accepted: true }, 'terminal.focus': { focused: true } }

function taskInput(detail: ChangeDetail, section = 1, position = 0) {
  return { action: 'task' as const, change: detail.name, workspaceId: detail.workspaceId!, profile: 'codex-skills' as const,
    target: { terminalId: 'x-done' }, task: { section, position, fingerprint: detail.tasksFingerprint! } }
}
const duplicateTasks = '## First\n- [ ] duplicate\n## Second\n- [ ] duplicate\n- [x] done\n'

test('sends the selected duplicate from disk and leaves progress and file untouched', async () => {
  const { host, worker, path } = await setup({ ...sendHost })
  try {
    await writeChange(path, 'add-x', duplicateTasks)
    const detail = (await worker.request('changes.detail', { name: 'add-x' }))!
    const input = taskInput(detail)
    assert.equal(detail.workspaceId, 'w1')
    assert.deepEqual(await worker.request('agent.run', { ...input, prompt: 'forged task' }), { surface: 'open-terminal', agent: 'codex' })
    const sent = host.callsOf('terminal.sendText')[0] as { text: string; terminalId: string }
    assert.equal(sent.terminalId, 'x-done')
    assert.ok(sent.text.includes('"sectionTitle":"Second"'))
    assert.ok(sent.text.includes('"position":1'))
    assert.ok(!sent.text.includes('forged task'))
    assert.equal(await readFile(join(path, 'openspec/changes/add-x/tasks.md'), 'utf8'), duplicateTasks)
    assert.deepEqual((await worker.request('changes.detail', { name: 'add-x' }))?.tasks, { done: 1, total: 3 })
    assert.deepEqual(worker.refusals, [])
  } finally { await worker.deactivate() }
})

test('refuses changed text, sections, positions, completion, deletion and unrelated file edits', async () => {
  const { host, worker, path } = await setup({ ...sendHost })
  try {
    for (const updated of [
      duplicateTasks.replace('duplicate', 'changed'), duplicateTasks.replace('## Second', '## Renamed'),
      duplicateTasks.replace('## Second\n', '## Second\n- [ ] inserted\n'),
      duplicateTasks.replace(/\[ \]/g, '[x]'), '## First\n- [ ] duplicate\n', duplicateTasks + '\ncomment\n'
    ]) {
      await writeChange(path, 'add-x', duplicateTasks)
      const input = taskInput((await worker.request('changes.detail', { name: 'add-x' }))!)
      await writeChange(path, 'add-x', updated)
      await assert.rejects(worker.request('agent.run', input), /Refresh and select/)
    }
    await writeChange(path, 'add-x', duplicateTasks)
    const input = taskInput((await worker.request('changes.detail', { name: 'add-x' }))!)
    await rm(join(path, 'openspec/changes/add-x/tasks.md'))
    await assert.rejects(worker.request('agent.run', input), /Refresh and select/)
    assert.equal(host.callsOf('terminal.sendText').length, 0)
    assert.ok(worker.posts.some((p) => p.event === 'changes.changed'))
  } finally { await worker.deactivate() }
})

test('refuses archived, deleted, malformed, completed, remote and wrong-workspace task selections', async () => {
  const { host, worker, path } = await setup({ ...sendHost })
  try {
    await writeChange(path, 'add-x', duplicateTasks)
    const input = taskInput((await worker.request('changes.detail', { name: 'add-x' }))!)
    for (const task of [{ ...input.task, position: 1 }, { ...input.task, section: -1 }, { ...input.task, position: 0.5 }, { ...input.task, fingerprint: 'forged' }]) {
      await assert.rejects(worker.request('agent.run', { ...input, task }), /Refresh and select/)
    }
    await assert.rejects(worker.request('agent.run', { ...input, workspaceId: undefined }), /needs its workspace/)
    await assert.rejects(worker.request('agent.run', { ...input, workspaceId: 'other' }), /changed/)
    await assert.rejects(worker.request('agent.run', { ...input, change: '../add-x' }))
    await mkdir(join(path, 'openspec/changes/archive'), { recursive: true })
    await rename(join(path, 'openspec/changes/add-x'), join(path, 'openspec/changes/archive/2026-11-27-add-x'))
    await assert.rejects(worker.request('agent.run', input), /Refresh and select/)
    await writeChange(path, 'add-x', duplicateTasks)
    await rm(join(path, 'openspec/changes/add-x'), { recursive: true })
    await assert.rejects(worker.request('agent.run', input), /Refresh and select/)
    await writeChange(path, 'add-x', duplicateTasks)
    host.respond('workspace.list', { workspaces: [{ id: 'w1', kind: 'folder', name: 'repo', path, branch: null, hostId: 'ssh' }], truncated: false })
    await assert.rejects(worker.request('agent.run', input), /Refresh and select/)
    assert.equal(host.callsOf('terminal.sendText').length, 0)
  } finally { await worker.deactivate() }
})

test('revalidates task and workspace after destination discovery, including new sessions', async () => {
  const { host, worker, path } = await setup({ ...sendHost })
  try {
    await writeChange(path, 'add-x', duplicateTasks)
    const input = taskInput((await worker.request('changes.detail', { name: 'add-x' }))!)
    host.respond('agents.list', async () => {
      await writeChange(path, 'add-x', duplicateTasks + '\nchanged during selection')
      return { agents: agentRows }
    })
    await assert.rejects(worker.request('agent.run', input), /Refresh and select/)
    await assert.rejects(worker.request('agent.run', { ...input, target: 'new' }), /Refresh and select/)
    host.respond('agents.list', () => {
      host.respond('workspace.list', { workspaces: [{ id: 'w1', kind: 'folder', name: 'repo', path: '/tmp', branch: null, hostId: 'local' }], truncated: false })
      return { agents: agentRows }
    })
    await assert.rejects(worker.request('agent.run', input), /workspace changed/)
    assert.equal(host.callsOf('terminal.sendText').length, 0)
  } finally { await worker.deactivate() }
})

test('refuses task roots redirected through symlinks', async () => {
  const { host, worker, path } = await setup({ ...sendHost })
  try {
    const outside = await mkdtemp(join(tmpdir(), 'openspec-pulse-task-root-'))
    await writeChange(outside, 'add-x', duplicateTasks)
    await symlink(join(outside, 'openspec'), join(path, 'openspec'))
    const input = taskInput((await worker.request('changes.detail', { name: 'add-x' }))!)
    await assert.rejects(worker.request('agent.run', input), /Refresh and select/)
    assert.equal(host.callsOf('terminal.sendText').length, 0)
  } finally { await worker.deactivate() }
})

test('task delivery shares the double-send guard and handles session rejection without fallback', async () => {
  const { host, worker, path } = await setup({ ...sendHost })
  try {
    await writeChange(path, 'add-x', duplicateTasks)
    const input = taskInput((await worker.request('changes.detail', { name: 'add-x' }))!)
    const results = await Promise.allSettled([worker.request('agent.run', input), worker.request('agent.run', input)])
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
    assert.equal(host.callsOf('terminal.sendText').length, 1)
    host.respond('terminal.sendText', { accepted: false })
    await assert.rejects(worker.request('agent.run', input), /did not accept/)
    host.respond('agents.list', { agents: [{ ...agentRows[2], state: 'blocked' }] })
    await assert.rejects(worker.request('agent.run', input), /blocked/)
    assert.equal(host.callsOf('terminal.sendText').length, 2)
    assert.deepEqual((await worker.request('changes.detail', { name: 'add-x' }))?.tasks, { done: 1, total: 3 })
  } finally { await worker.deactivate() }
})

test('saves preferences per workspace, keeping unknown fields, and rejects stale or invalid ones', async () => {
  const { host, worker } = await setup({ ...sendHost })
  try {
    const first = await worker.request('agent.options')
    assert.deepEqual(first?.prefs, { profile: 'claude-skills', model: null })
    assert.deepEqual(first?.sessions.map((s) => [s.terminalId, s.available]), [['c-done', true], ['c-work', false], ['x-done', true]])
    assert.deepEqual(await worker.request('agent.prefs.set', { workspaceId: 'w1', prefs: { profile: 'codex-skills', model: null } }), { profile: 'codex-skills', model: null })
    assert.deepEqual((await worker.request('agent.options'))?.prefs, { profile: 'codex-skills', model: null })
    // Another workspace keeps its own default.
    host.respond('workspace.readContext', { workspaceId: 'w2', branch: 'main', displayName: 'o', terminals: [] })
    host.respond('workspace.list', { workspaces: [{ id: 'w2', kind: 'folder', name: 'o', path: '/tmp', branch: null, hostId: 'local' }], truncated: false })
    assert.deepEqual((await worker.request('agent.options'))?.prefs, { profile: 'claude-skills', model: null })
    await assert.rejects(worker.request('agent.prefs.set', { workspaceId: 'w1', prefs: { profile: 'claude-skills', model: null } }), /changed/)
    await assert.rejects(worker.request('agent.prefs.set', { workspaceId: 'w2', prefs: { profile: 'codex-skills', model: 'gpt-x' } }))
    await assert.rejects(worker.request('agent.prefs.set', { workspaceId: 'w2', prefs: { profile: 'nope' as never, model: null } }))
  } finally {
    await worker.deactivate()
  }
})

test('sends the Codex command to a chosen idle Codex session and refuses the rest, sending nothing', async () => {
  const { host, worker, path } = await setup({ ...sendHost })
  try {
    await mkdir(join(path, 'openspec', 'changes', 'add-x'), { recursive: true })
    await writeFile(join(path, 'openspec', 'changes', 'add-x', 'tasks.md'), '- [ ] a\n')
    const base = { action: 'apply' as const, change: 'add-x', workspaceId: 'w1' }
    assert.deepEqual(await worker.request('agent.run', { ...base, profile: 'codex-skills', target: { terminalId: 'x-done' } }), { surface: 'open-terminal', agent: 'codex' })
    assert.deepEqual(host.callsOf('terminal.sendText'), [{ terminalId: 'x-done', text: '$openspec-apply-change add-x', enter: true }])

    const sent = host.callsOf('terminal.sendText').length
    // Busy, wrong agent, unknown session, workspace changed, model on Codex, bad profile.
    await assert.rejects(worker.request('agent.run', { ...base, profile: 'claude-skills', target: { terminalId: 'c-work' } }), /working/)
    await assert.rejects(worker.request('agent.run', { ...base, profile: 'claude-skills', target: { terminalId: 'x-done' } }), /not running/)
    await assert.rejects(worker.request('agent.run', { ...base, profile: 'claude-skills', target: { terminalId: 'gone' } }), /no longer/)
    await assert.rejects(worker.request('agent.run', { ...base, workspaceId: 'w9', target: { terminalId: 'c-done' } }), /changed/)
    await assert.rejects(worker.request('agent.run', { ...base, profile: 'codex-skills', model: 'gpt-x', target: 'new' }), /cannot choose a model/)
    await assert.rejects(worker.request('agent.run', { ...base, profile: 'nope' as never }))
    await assert.rejects(worker.request('agent.run', { ...base, change: '../x', target: { terminalId: 'c-done' } }))
    assert.equal(host.callsOf('terminal.sendText').length, sent)
  } finally {
    await worker.deactivate()
  }
})

test('a session that turns blocked, or a delivery that is refused, is an error with no other send', async () => {
  const { host, worker } = await setup({ ...sendHost })
  try {
    host.respond('agents.list', { agents: [{ terminalId: 'c-done', title: null, agent: 'claude', state: 'blocked', stateStartedAt: 1 }] })
    await assert.rejects(worker.request('agent.run', { action: 'explore', target: { terminalId: 'c-done' } }), /blocked/)
    assert.equal(host.callsOf('terminal.sendText').length, 0)

    host.respond('agents.list', { agents: agentRows })
    host.respond('terminal.sendText', { accepted: false })
    await assert.rejects(worker.request('agent.run', { action: 'explore', target: 'auto' }), /did not accept/)
    await assert.rejects(worker.request('agent.run', { action: 'explore', target: { terminalId: 'c-done' } }), /did not accept/)
    // Rejected twice, and nothing went anywhere else (no focus, no launch).
    assert.equal(host.callsOf('terminal.focus').length, 0)
  } finally {
    await worker.deactivate()
  }
})

test('sends one command at a time', async () => {
  const { host, worker } = await setup({ ...sendHost })
  try {
    const results = await Promise.allSettled([
      worker.request('agent.run', { action: 'explore', target: { terminalId: 'c-done' } }),
      worker.request('agent.run', { action: 'explore', target: { terminalId: 'c-done' } })
    ])
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
    assert.equal(host.callsOf('terminal.sendText').length, 1)
  } finally {
    await worker.deactivate()
  }
})

test('dependency reads refresh metadata, stay read-only and reject workspace or root changes mid-read', async () => {
  const { host, worker, path } = await setup()
  const dir = join(path, 'openspec', 'changes', 'dependent')
  try {
    await writeChange(path, 'dependent', '- [ ] one\n')
    await writeFile(join(dir, 'proposal.md'), 'Depends on: `base`')
    await writeFile(join(dir, '.openspec.yaml'), 'order: 1\n')
    const first = await worker.request('changes.list')
    assert.ok(first.status === 'ok')
    if (first.status !== 'ok') return
    assert.deepEqual(first.changes[0].ordering?.dependencies, ['base'])
    await writeFile(join(dir, 'proposal.md'), 'Depende de: `other`')
    const next = await worker.request('changes.list')
    assert.ok(next.status === 'ok' && next.changes[0].ordering?.dependencies[0] === 'other')
    assert.equal(await readFile(join(dir, '.openspec.yaml'), 'utf8'), 'order: 1\n')
    assert.equal(host.callsOf('terminal.sendText').length, 0)
    assert.equal(host.callsOf('agent.launch').length, 0)

    let reads = 0
    host.respond('workspace.readContext', () => ({ workspaceId: ++reads === 1 ? 'w1' : 'w2', branch: 'main', displayName: 'repo', terminals: [] }))
    await assert.rejects(worker.request('changes.list'), /workspace changed/)

    reads = 0
    host.respond('workspace.readContext', async () => {
      if (++reads === 2) {
        const changes = join(path, 'openspec', 'changes')
        await rename(changes, changes + '-moved')
        await symlink(changes + '-moved', changes)
      }
      return { workspaceId: 'w1', branch: 'main', displayName: 'repo', terminals: [] }
    })
    await assert.rejects(worker.request('changes.list'), /workspace changed/)
  } finally { await worker.deactivate() }
})

async function writeDelta(root: string, change: string, capability: string): Promise<void> {
  const dir = join(root, 'openspec', 'changes', change, 'specs', capability)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'spec.md'), '# Delta')
}

test('relations use nested capabilities and explicit origins, refresh archive moves and removed deltas', async () => {
  const { host, worker, path } = await setup()
  try {
    for (const name of ['same', 'other']) {
      await writeDelta(path, name, 'billing/invoices')
      await writeDelta(path, name, 'shared')
    }
    await writeDelta(path, 'sales', 'sales/invoices')
    await writeChange(path, 'empty', '- [ ] no deltas')
    await writeDelta(path, 'archive/2026-11-27-same', 'billing/invoices')
    const spec = join(path, 'openspec', 'specs', 'billing', 'invoices')
    await mkdir(spec, { recursive: true })
    await writeFile(join(spec, 'spec.md'), '## Purpose\nInvoices.\n### Requirement: A')
    await worker.request('changes.list')
    const detail = await worker.request('changes.detail', { name: 'same', workspaceId: 'w1' })
    assert.deepEqual(detail?.specs, ['specs/billing/invoices/spec.md', 'specs/shared/spec.md'])
    assert.deepEqual(detail?.related, [
      { source: 'active', name: 'other' }, { source: 'archive', name: 'same', folder: '2026-11-27-same' }
    ])
    assert.deepEqual((await worker.request('changes.detail', { name: 'empty' }))?.related, [])
    assert.equal((await worker.request('specs.detail', { capability: 'billing/invoices', workspaceId: 'w1' }))?.changes.length, 3)
    assert.equal(await worker.request('specs.detail', { capability: '../x', workspaceId: 'w1' }), null)
    await assert.rejects(worker.request('specs.detail', { capability: 'billing/invoices', workspaceId: 'old' }), /workspace changed/)

    // Start a real watcher; wait for its notification rather than forcing cache invalidation.
    const posted = worker.posts.length
    await rename(join(path, 'openspec', 'changes', 'other'), join(path, 'openspec', 'changes', 'archive', '2026-11-27-other'))
    for (let i = 0; i < 40 && worker.posts.length === posted; i++) await new Promise(resolve => setTimeout(resolve, 50))
    assert.ok(worker.posts.length > posted)
    const moved = await worker.request('changes.detail', { name: 'same' })
    assert.equal(moved?.related?.length, 2)
    assert.ok(moved?.related?.every(ref => ref.source === 'archive'))
    assert.equal((await worker.request('archive.detail', { folder: '2026-11-27-other', workspaceId: 'w1' }))?.related?.length, 2)
    await rm(join(path, 'openspec', 'changes', 'archive', '2026-11-27-other', 'specs'), { recursive: true })
    await worker.request('changes.list') // Manual refresh also works without watcher delivery.
    assert.equal((await worker.request('changes.detail', { name: 'same' }))?.related?.length, 1)
    assert.equal(host.callsOf('terminal.sendText').length, 0)
    assert.equal(host.callsOf('editor.open').length, 0)
    assert.deepEqual(worker.refusals, [])
  } finally { await worker.deactivate() }
})

test('relation requests discard workspace/root changes during reads and never reuse another workspace', async () => {
  const { host, worker, path } = await setup()
  try {
    await writeDelta(path, 'one', 'shared')
    await writeDelta(path, 'two', 'shared')
    await worker.request('changes.list')
    assert.equal((await worker.request('changes.detail', { name: 'one' }))?.related?.length, 1)
    let reads = 0
    host.respond('workspace.readContext', () => ({ workspaceId: ++reads === 1 ? 'w1' : 'w2', branch: 'main', displayName: 'repo', terminals: [] }))
    await assert.rejects(worker.request('changes.detail', { name: 'one', workspaceId: 'w1' }), /workspace.*changed/)
    host.respond('workspace.readContext', { workspaceId: 'w1', branch: 'main', displayName: 'repo', terminals: [] })
    reads = 0
    host.respond('workspace.readContext', async () => {
      if (++reads === 2) {
        await rename(join(path, 'openspec'), join(path, 'previous'))
        await symlink(join(path, 'previous'), join(path, 'openspec'))
      }
      return { workspaceId: 'w1', branch: 'main', displayName: 'repo', terminals: [] }
    })
    await assert.rejects(worker.request('archive.detail', { folder: 'unknown' }), /workspace.*changed/)
    const other = await mkdtemp(join(tmpdir(), 'openspec-pulse-relations-'))
    await writeDelta(other, 'one', 'shared')
    host.respond('workspace.readContext', { workspaceId: 'w2', branch: 'main', displayName: 'other', terminals: [] })
    host.respond('workspace.list', { workspaces: [{ id: 'w2', kind: 'folder', name: 'other', path: other, branch: null, hostId: 'local' }], truncated: false })
    await worker.emit('workspace.changed', { context: { workspaceId: 'w2', branch: 'main', displayName: 'other', terminals: [] } })
    assert.deepEqual((await worker.request('changes.detail', { name: 'one', workspaceId: 'w2' }))?.related, [])
    host.respond('workspace.list', { workspaces: [{ id: 'w2', kind: 'folder', name: 'other', path: other, branch: null, hostId: 'ssh' }], truncated: false })
    assert.equal(await worker.request('changes.detail', { name: 'one', workspaceId: 'w2' }), null)
  } finally { await worker.deactivate() }
})

test('relation read errors remain visible and retryable; missing targets never navigate elsewhere', async () => {
  const { host, worker, path } = await setup()
  try {
    await writeDelta(path, 'one', 'shared')
    await writeChange(path, 'broken', '- [ ] pending')
    const broken = join(path, 'openspec', 'changes', 'broken', 'specs')
    await writeFile(broken, 'not a directory')
    await assert.rejects(worker.request('changes.detail', { name: 'one', workspaceId: 'w1' }))
    await rm(broken)
    assert.deepEqual((await worker.request('changes.detail', { name: 'one', workspaceId: 'w1' }))?.related, [])
    assert.equal(await worker.request('archive.detail', { folder: 'one', workspaceId: 'w1' }), null)
    assert.equal(await worker.request('changes.detail', { name: 'deleted', workspaceId: 'w1' }), null)
    assert.equal(host.callsOf('editor.open').length, 0)
  } finally { await worker.deactivate() }
})

test('file links reject stale workspace identities and roots before opening the editor', async () => {
  const { host, worker, path } = await setup()
  try {
    await writeChange(path, 'one', '- [ ] pending')
    const spec = join(path, 'openspec', 'specs', 'shared')
    await mkdir(spec, { recursive: true })
    await writeFile(join(spec, 'spec.md'), '# Shared')
    assert.deepEqual(await worker.request('specs.open', { capability: 'shared', workspaceId: 'old' }), { opened: false })
    assert.deepEqual(await worker.request('changes.open', { name: 'one', workspaceId: 'old' }), { opened: false })
    let reads = 0
    host.respond('workspace.readContext', async () => {
      if (++reads === 2) {
        await rename(join(path, 'openspec', 'specs'), join(path, 'previous-specs'))
        await symlink(join(path, 'previous-specs'), join(path, 'openspec', 'specs'))
      }
      return { workspaceId: 'w1', branch: 'main', displayName: 'repo', terminals: [] }
    })
    assert.deepEqual(await worker.request('specs.open', { capability: 'shared', workspaceId: 'w1' }), { opened: false })
    assert.equal(host.callsOf('editor.open').length, 0)
  } finally { await worker.deactivate() }
})


const git = promisify(execFile)
async function worktreeFixture(stores?: StoreReader) {
  const fixture = await setup({}, undefined, undefined, stores)
  const sibling = fixture.path + '-sibling'
  const unrelated = fixture.path + '-unrelated'
  await git('/usr/bin/git', ['init', '-b', 'main', fixture.path])
  await git('/usr/bin/git', ['-C', fixture.path, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--allow-empty', '-m', 'fixture'])
  await git('/usr/bin/git', ['-C', fixture.path, 'worktree', 'add', '-b', 'parallel', sibling])
  await git('/usr/bin/git', ['init', '-b', 'parallel', unrelated])
  const alias = fixture.path + '-alias'
  await symlink(sibling, alias)
  const row = (id: string, path: string, hostId: string = 'local') => ({ id, path, hostId, kind: 'folder' as const, name: id, branch: 'parallel' })
  const rows = [row('w1', fixture.path), row('w2', sibling), row('alias', alias), row('unrelated', unrelated),
    row('remote', sibling, 'ssh'), row('missing', sibling + '-gone'), row('nested', join(sibling, 'openspec'))]
  fixture.host.respond('workspace.list', { workspaces: rows, truncated: false })
  const cleanup = async () => {
    await fixture.worker.deactivate()
    for (const path of [alias, sibling, unrelated, fixture.path]) await rm(path, { recursive: true, force: true })
  }
  return { ...fixture, sibling, rows, cleanup }
}

test('browse includes only canonical Git siblings, preserves duplicate origins and leaves status focused', async () => {
  const f = await worktreeFixture()
  try {
    await writeChange(f.path, 'same', '- [ ] focus')
    await writeChange(f.sibling, 'same', '- [ ] sibling')
    await writeChange(f.sibling, 'archive/2026-11-27-same', '- [x] archived')
    const dir = join(f.sibling, 'openspec', 'specs', 'shared')
    await mkdir(dir, { recursive: true }); await writeFile(join(dir, 'spec.md'), '# Shared')
    const focused = await f.worker.request('changes.list')
    const statuses = f.host.callsOf('statusBar.update').length
    const snapshot = await f.worker.request('worktrees.browse', { focusedWorkspaceId: 'w1', scope: 'all' })
    assert.deepEqual(snapshot.worktrees.map(w => w.workspaceId), ['w1', 'w2', 'alias'])
    assert.equal(snapshot.list.status, 'ok')
    if (snapshot.list.status !== 'ok') return
    assert.deepEqual(snapshot.list.changes.map(c => [c.name, c.origin?.workspaceId]), [['same', 'w1'], ['same', 'w2'], ['same', 'alias']])
    assert.equal(snapshot.worktrees[1].branch, 'parallel')
    assert.equal(snapshot.specs.length, 2)
    assert.equal(snapshot.archive.length, 2)
    assert.ok(snapshot.diagnostics.some(d => d.includes('missing')))
    assert.equal(f.host.callsOf('statusBar.update').length, statuses)
    assert.deepEqual(await f.worker.request('changes.list'), focused)
    const one = await f.worker.request('worktrees.browse', { focusedWorkspaceId: 'w1', scope: 'w2' })
    assert.ok(one.list.status === 'ok' && one.list.changes.length === 1)
    assert.equal((await f.worker.request('changes.detail', { name: 'same', workspaceId: 'w2' }))?.sections[0].tasks[0].text, 'sibling')
    assert.equal((await f.worker.request('archive.detail', { folder: '2026-11-27-same', workspaceId: 'w2' }))?.name, 'same')
    assert.equal((await f.worker.request('specs.detail', { capability: 'shared', workspaceId: 'w2' }))?.capability, 'shared')
    assert.deepEqual(await f.worker.request('changes.open', { name: 'same', workspaceId: 'w2' }), { opened: true })
    assert.deepEqual(await f.worker.request('specs.open', { capability: 'shared', workspaceId: 'w2' }), { opened: true })
    assert.deepEqual(f.host.callsOf('editor.open').slice(-2), [
      { workspaceId: 'w2', path: 'openspec/changes/same/tasks.md' },
      { workspaceId: 'w2', path: 'openspec/specs/shared/spec.md' }
    ])
    assert.deepEqual(f.worker.refusals, [])
  } finally { await f.cleanup() }
})

test('sibling requests reject forged ids, agent actions, initialization and deleted or reassigned origins', async () => {
  const f = await worktreeFixture()
  try {
    await writeChange(f.sibling, 'same', '- [ ] sibling')
    for (const workspaceId of ['unrelated', 'remote', 'missing', f.sibling]) {
      await assert.rejects(f.worker.request('changes.detail', { name: 'same', workspaceId }))
      assert.deepEqual(await f.worker.request('changes.open', { name: 'same', workspaceId }).catch(() => ({ opened: false })), { opened: false })
    }
    await assert.rejects(f.worker.request('agent.run', { action: 'apply', change: 'same', workspaceId: 'w2' }), /changed/)
    await assert.rejects(f.worker.request('openspec.init', { workspaceId: 'w2' }), /focused/)
    await assert.rejects(f.worker.request('worktrees.browse', { focusedWorkspaceId: 'old', scope: 'all' }), /changed/)
    await assert.rejects(f.worker.request('worktrees.browse', { focusedWorkspaceId: 'w1', scope: 'unrelated' }), /no longer/)
    f.host.respond('workspace.list', { workspaces: f.rows.filter(r => r.id !== 'w2'), truncated: false })
    await assert.rejects(f.worker.request('changes.detail', { name: 'same', workspaceId: 'w2' }))
    assert.equal(f.host.callsOf('editor.open').length, 0)
    assert.equal(f.host.callsOf('terminal.sendText').length, 0)
    assert.equal(f.host.callsOf('agent.launch').length, 0)
  } finally { await f.cleanup() }
})

test('sibling reads cancel focus changes and revalidate membership immediately before opening', async () => {
  const f = await worktreeFixture()
  try {
    await writeChange(f.sibling, 'same', '- [ ] sibling')
    let reads = 0
    f.host.respond('workspace.readContext', () => ({ workspaceId: ++reads < 2 ? 'w1' : 'unrelated', branch: 'main', displayName: 'repo', terminals: [] }))
    await assert.rejects(f.worker.request('changes.detail', { name: 'same', workspaceId: 'w2' }))
    reads = 0
    f.host.respond('workspace.readContext', () => {
      if (++reads === 2) f.host.respond('workspace.list', { workspaces: f.rows.map(r => r.id === 'w2' ? { ...r, path: f.path + '-unrelated' } : r), truncated: false })
      return { workspaceId: 'w1', branch: 'main', displayName: 'repo', terminals: [] }
    })
    assert.deepEqual(await f.worker.request('changes.open', { name: 'same', workspaceId: 'w2' }), { opened: false })
    assert.equal(f.host.callsOf('editor.open').length, 0)
  } finally { await f.cleanup() }
})

test('project commands require exact local consent, persist it, and invalidate it on edits', async () => {
  const { host, worker, path } = await setup({
    'agents.list': { agents: [{ terminalId: 't1', title: null, agent: 'claude', state: 'done', stateStartedAt: 0 }] },
    'terminal.sendText': { accepted: true }, 'terminal.focus': { focused: true }
  })
  try {
    await writeChange(path, 'add-x', '- [ ] Work')
    const configPath = join(path, 'openspec', 'pulse.json')
    const config = { schemaVersion: 1, commands: { apply: '/custom {change}' } }
    await writeFile(configPath, JSON.stringify(config))
    const options = (await worker.request('agent.options'))!
    const fingerprint = options.workflow!.fingerprint!
    const base = { action: 'apply' as const, change: 'add-x', workspaceId: 'w1', workflowFingerprint: fingerprint }
    await assert.rejects(worker.request('agent.run', base), /Accept the effective/)
    await assert.rejects(worker.request('agent.run', { ...base, approval: { fingerprint, command: '/different add-x' } }), /Accept the effective/)
    assert.equal(host.callsOf('terminal.sendText').length, 0)
    const approved = { ...base, approval: { fingerprint, command: '/custom add-x' } }
    await worker.request('agent.run', approved)
    assert.deepEqual(host.callsOf('terminal.sendText').at(-1), { terminalId: 't1', text: '/custom add-x', enter: true })
    assert.deepEqual((await worker.request('agent.options'))?.approvedCommands, ['/custom add-x'])
    await worker.request('agent.run', base)
    assert.equal(host.callsOf('terminal.sendText').length, 2)
    await writeFile(configPath, JSON.stringify({ ...config, commands: { apply: '/changed {change}' } }))
    await assert.rejects(worker.request('agent.run', approved), /configuration changed/)
    const changed = (await worker.request('agent.options'))!
    assert.deepEqual(changed.approvedCommands, [])
    await assert.rejects(worker.request('agent.run', { ...base, workflowFingerprint: changed.workflow!.fingerprint }), /Accept the effective/)
    assert.equal(host.callsOf('terminal.sendText').length, 2)
    await writeFile(configPath, '{bad')
    assert.match((await worker.request('agent.options'))!.workflow!.error!, /pulse.json/)
    await worker.request('agent.run', { action: 'apply', change: 'add-x', workspaceId: 'w1', workflowFingerprint: null })
    assert.deepEqual(host.callsOf('terminal.sendText').at(-1), { terminalId: 't1', text: '/openspec-apply-change add-x', enter: true })
  } finally { await worker.deactivate() }
})

test('project config changes during destination lookup refuse both existing and new sessions', async () => {
  const { host, worker, path } = await setup({ 'terminal.sendText': { accepted: true } })
  try {
    await writeChange(path, 'add-x', '- [ ] Work')
    const configPath = join(path, 'openspec', 'pulse.json')
    for (const terminalId of ['t1', null]) {
      await writeFile(configPath, '{"schemaVersion":1,"commands":{"apply":"/custom {change}"}}')
      host.respond('agents.list', { agents: [] })
      const options = (await worker.request('agent.options'))!
      const fingerprint = options.workflow!.fingerprint!
      host.respond('agents.list', async () => {
        await writeFile(configPath, '{"schemaVersion":1,"commands":{"apply":"/unexpected {change}"}}')
        return { agents: terminalId ? [{ terminalId, title: null, agent: 'claude', state: 'done', stateStartedAt: 0 }] : [] }
      })
      await assert.rejects(worker.request('agent.run', { action: 'apply', change: 'add-x', workspaceId: 'w1',
        workflowFingerprint: fingerprint, approval: { fingerprint, command: '/custom add-x' } }), /configuration changed/)
    }
    assert.equal(host.callsOf('terminal.sendText').length, 0)
  } finally { await worker.deactivate() }
})

test('project command approval does not transfer to another workspace or reassigned root', async () => {
  const { host, worker, path } = await setup({
    'agents.list': { agents: [{ terminalId: 't1', title: null, agent: 'claude', state: 'done', stateStartedAt: 0 }] },
    'terminal.sendText': { accepted: true }, 'terminal.focus': { focused: true }
  })
  try {
    const text = '{"schemaVersion":1,"commands":{"apply":"/custom {change}"}}'
    await writeChange(path, 'add-x', '- [ ] Work')
    await writeFile(join(path, 'openspec', 'pulse.json'), text)
    const fingerprint = (await worker.request('agent.options'))!.workflow!.fingerprint!
    const input = { action: 'apply' as const, change: 'add-x', workspaceId: 'w1', workflowFingerprint: fingerprint,
      approval: { fingerprint, command: '/custom add-x' } }
    await worker.request('agent.run', input)
    const other = await mkdtemp(join(tmpdir(), 'pulse-workflow-other-'))
    await writeChange(other, 'add-x', '- [ ] Work')
    await writeFile(join(other, 'openspec', 'pulse.json'), text)
    host.respond('workspace.list', { workspaces: [{ id: 'w1', kind: 'folder', name: 'other', path: other, branch: null, hostId: 'local' }], truncated: false })
    await assert.rejects(worker.request('agent.run', input), /configuration changed/)
    assert.deepEqual((await worker.request('agent.options'))?.approvedCommands, [])
    host.respond('workspace.readContext', { workspaceId: 'w2', branch: 'main', displayName: 'repo', terminals: [] })
    host.respond('workspace.list', { workspaces: [{ id: 'w2', kind: 'folder', name: 'repo', path, branch: null, hostId: 'local' }], truncated: false })
    assert.deepEqual((await worker.request('agent.options'))?.approvedCommands, [])
    await assert.rejects(worker.request('agent.run', input), /workspace changed/)
    assert.equal(host.callsOf('terminal.sendText').length, 1)
  } finally { await worker.deactivate() }
})

test('pulse.json edits invalidate displayed artifacts and publish a refresh without sending', async () => {
  const { host, worker, path } = await setup()
  try {
    await writeChange(path, 'done', '- [x] Work')
    await worker.request('changes.list')
    const before = worker.posts.length
    await writeFile(join(path, 'openspec', 'pulse.json'), '{"schemaVersion":1,"requiredArtifacts":["design.md"]}')
    await new Promise(resolve => setTimeout(resolve, 400))
    assert.ok(worker.posts.slice(before).some(post => post.event === 'changes.changed'))
    const list = await worker.request('changes.list')
    assert.ok(list.status === 'ok')
    if (list.status === 'ok') assert.deepEqual(list.changes[0].missingArtifacts, ['design.md'])
    assert.equal(host.callsOf('terminal.sendText').length, 0)
  } finally { await worker.deactivate() }
})

const deliveryConfig = { schemaVersion: 1, tickets: [{ prefix: 'FAM', url: 'https://tracker.example/{ticket}' }], github: { repositories: ['example/project'], match: 'ticket-in-title' } }
async function deliveryFixture(path: string) {
  await writeChange(path, 'fam-123-feature', '- [x] one\n- [ ] two\n')
  await writeFile(join(path, 'openspec', 'pulse.json'), JSON.stringify(deliveryConfig))
}

test('delivery requests validate roots, login preferences, bounded batches and preserve local tasks', async () => {
  const calls: string[][] = []
  const service = new GithubDelivery(async (_binary, args) => {
    calls.push(args)
    return { stdout: args[0] === 'auth' ? 'test-token' : args[0] === 'api' ? '{"login":"temperatio"}' : JSON.stringify([{ number: 1, title: 'FAM-123 feature', url: 'https://github.com/example/project/pull/1', state: 'OPEN' }]) }
  })
  const { worker, path, host } = await setup({}, service)
  try {
    await deliveryFixture(path)
    const first = await worker.request('delivery.get', { workspaceId: 'w1', names: ['fam-123-feature'] })
    assert.equal(first.login, null)
    assert.equal(first.changes['fam-123-feature'].freshness, 'unknown')
    assert.equal(calls.length, 0)
    await worker.request('delivery.login.set', { workspaceId: 'w1', project: first.project, login: 'temperatio' })
    const next = await worker.request('delivery.get', { workspaceId: 'w1', names: ['fam-123-feature'] })
    // The adapter is simulated; binary availability is the only local prerequisite.
    if (next.changes['fam-123-feature'].error?.startsWith('gh is unavailable')) assert.equal(calls.length, 0)
    else { assert.equal(next.changes['fam-123-feature'].prs.length, 1); assert.equal(calls.length, 3) }
    assert.equal(await readFile(join(path, 'openspec/changes/fam-123-feature/tasks.md'), 'utf8'), '- [x] one\n- [ ] two\n')
    await assert.rejects(worker.request('delivery.get', { workspaceId: 'w1', names: Array(7).fill('fam-123-feature') }))
    await assert.rejects(worker.request('delivery.get', { workspaceId: 'w1', names: ['../other'] }))
    await assert.rejects(worker.request('delivery.get', { workspaceId: 'w1', names: ['fam-999-gone'] }))
    await assert.rejects(worker.request('delivery.login.set', { workspaceId: 'w1', project: '/forged', login: 'temperatio' }))
    await assert.rejects(worker.request('delivery.login.set', { workspaceId: 'w1', project: first.project, login: '--bad' }))
    assert.equal(host.callsOf('terminal.sendText').length, 0)
    assert.deepEqual(worker.refusals, [])
  } finally { await worker.deactivate() }
})

test('delivery account is project-bound, preserves unknown local metadata and enforces Pulse login', async () => {
  const { worker, path, storage } = await setup()
  try {
    await deliveryFixture(path)
    const context = await worker.request('delivery.get', { workspaceId: 'w1', names: [] })
    await storage.set(`delivery:v1:${context.project}`, { v: 1, future: true, login: 'old' })
    await writeFile(join(path, 'openspec/pulse.json'), JSON.stringify({ ...deliveryConfig, github: { repositories: ['Dos2Locos/openspec-pulse'], match: 'ticket-in-title' } }))
    await assert.rejects(worker.request('delivery.login.set', { workspaceId: 'w1', project: context.project, login: 'other-user' }))
    await worker.request('delivery.login.set', { workspaceId: 'w1', project: context.project, login: 'temperatio' })
    assert.deepEqual(await storage.get(`delivery:v1:${context.project}`), { v: 1, future: true, login: 'temperatio' })
    await worker.request('delivery.login.set', { workspaceId: 'w1', project: context.project, login: null })
    assert.deepEqual(await storage.get(`delivery:v1:${context.project}`), { v: 1, future: true, login: null })
  } finally { await worker.deactivate() }
})

test('delivery requests reject focus and configuration changes during a simulated query', async () => {
  let mutate: (() => Promise<void>) | null = null
  const service = new GithubDelivery(async (_binary, args) => {
    if (args[0] === 'api' && mutate) await mutate()
    return { stdout: args[0] === 'auth' ? 'test-token' : args[0] === 'api' ? '{"login":"temperatio"}' : '[]' }
  })
  const { worker, path, host } = await setup({}, service)
  try {
    await deliveryFixture(path)
    const context = await worker.request('delivery.get', { workspaceId: 'w1', names: [] })
    await worker.request('delivery.login.set', { workspaceId: 'w1', project: context.project, login: 'temperatio' })
    mutate = async () => { host.respond('workspace.readContext', { workspaceId: 'gone', branch: 'main', displayName: 'gone', terminals: [] }) }
    {
      await assert.rejects(worker.request('delivery.get', { workspaceId: 'w1', names: ['fam-123-feature'] }))
      host.respond('workspace.readContext', { workspaceId: 'w1', branch: 'main', displayName: 'repo', terminals: [] })
      mutate = async () => { await writeFile(join(path, 'openspec/pulse.json'), JSON.stringify({ ...deliveryConfig, resumePrefixes: ['Next:'] })) }
      await assert.rejects(worker.request('delivery.get', { workspaceId: 'w1', names: ['fam-123-feature'] }))
    }
    await assert.rejects(worker.request('delivery.get', { workspaceId: 'foreign', names: [] }))
    await assert.rejects(worker.request('delivery.login.set', { workspaceId: 'foreign', project: context.project, login: 'temperatio' }))
  } finally { await worker.deactivate() }
})

test('recorded spend refreshes configuration and logs, remains read-only and rejects stale focus', async () => {
  const { worker, host, path } = await setup()
  try {
    const dir = join(path, 'openspec/changes/app-spend')
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'tasks.md'), '- [ ] Task\n')
    await writeFile(join(dir, 'agent-runs.jsonl'), '{"id":"a","costUsd":0.12}\n{"inputTokens":100}\n')
    const browse = () => worker.request('worktrees.browse', { focusedWorkspaceId: 'w1', scope: 'focused' })
    assert.equal((await browse()).spend?.enabled, false)
    await writeFile(join(path, 'openspec/pulse.json'), '{"schemaVersion":1,"runs":{"file":"agent-runs.jsonl"}}')
    const first = await browse()
    assert.equal(first.spend?.total.costUsd, 0.12)
    assert.equal(first.spend?.total.unknownCosts, 1)
    await writeFile(join(dir, 'agent-runs.jsonl'), '{"costUsd":2}\n')
    assert.equal((await browse()).spend?.total.costUsd, 2)
    await writeFile(join(path, 'openspec/pulse.json'), '{"schemaVersion":1,"runs":false}')
    assert.equal((await browse()).spend?.enabled, false)
    await assert.rejects(worker.request('worktrees.browse', { focusedWorkspaceId: 'other', scope: 'focused' }), /workspace changed/)
    assert.equal(host.callsOf('terminal.sendText').length, 0)
    assert.equal(host.callsOf('editor.open').length, 0)
    assert.equal(await readFile(join(dir, 'tasks.md'), 'utf8'), '- [ ] Task\n')
    let reads = 0
    host.respond('workspace.readContext', () => ({ workspaceId: ++reads < 4 ? 'w1' : 'other', branch: 'main', displayName: 'repo', terminals: [] }))
    await assert.rejects(browse(), /workspace changed|workspace is focused/)
  } finally { await worker.deactivate(); await rm(path, { recursive: true, force: true }) }
})

test('all worktrees deduplicate a shared store with overlapping scopes and separate unattributed logs', async () => {
  let shared = ''
  const stores = new StoreReader(async () => { throw new Error('No CLI expected in this fixture') })
  stores.resolve = async path => {
    const canonical = await realpath(path)
    return { workspacePath: canonical, dataPath: shared || canonical, kind: shared ? 'store' : 'local', storeId: shared ? 'fixture' : null, prefixes: [], fingerprint: JSON.stringify([canonical, shared]), diagnostics: [] }
  }
  const f = await worktreeFixture(stores)
  try {
    shared = await realpath(join(f.path))
    await mkdir(join(shared, 'openspec/changes/app-one'), { recursive: true })
    await mkdir(join(shared, 'openspec/changes/other-two'), { recursive: true })
    await mkdir(join(shared, 'logs'))
    await writeFile(join(shared, 'openspec/pulse.json'), '{"schemaVersion":1,"runs":{"file":"runs.jsonl","folders":["logs"]}}')
    await writeFile(join(shared, 'openspec/changes/app-one/runs.jsonl'), '{"id":"one","costUsd":1}\n')
    await writeFile(join(shared, 'openspec/changes/other-two/runs.jsonl'), '{"id":"two","costUsd":10}\n')
    await writeFile(join(shared, 'logs/extra.jsonl'), '{"id":"three","costUsd":2}\n')
    await f.storage.set(storeScopeKey('w1', shared), { v: 1, prefixes: ['app-'] })
    await f.storage.set(storeScopeKey('w2', shared), { v: 1, prefixes: ['app-one'] })
    await f.storage.set(storeScopeKey('alias', shared), { v: 1, prefixes: ['app-one'] })
    const browse = () => f.worker.request('worktrees.browse', { focusedWorkspaceId: 'w1', scope: 'all' })
    const filtered = await browse()
    assert.equal(filtered.spend?.total.costUsd, 1)
    assert.equal(filtered.spend?.unattributed?.total.costUsd, 2)
    assert.equal(filtered.spend?.diagnostics.files, 1)
    await f.storage.set(storeScopeKey('w2', shared), { v: 1, prefixes: [] })
    const all = await browse()
    assert.equal(all.spend?.total.costUsd, 13)
    assert.equal(all.spend?.unattributed?.total.events, 0)
    assert.equal(f.host.callsOf('terminal.sendText').length, 0)
    assert.equal(f.host.callsOf('agent.launch').length, 0)
  } finally { await f.cleanup() }
})

test('spend discards stale costs when configuration changes, including invalidation retries', async () => {
  const { worker, host, path } = await setup()
  try {
    await mkdir(join(path, 'openspec/changes/a'), { recursive: true })
    const config = join(path, 'openspec/pulse.json')
    await writeFile(config, '{"schemaVersion":1,"runs":{"file":"runs.jsonl"}}')
    await writeFile(join(path, 'openspec/changes/a/runs.jsonl'), '{"costUsd":1}\n')
    let reads = 0
    host.respond('workspace.readContext', async () => {
      if (++reads === 4) await writeFile(config, '{"schemaVersion":1,"runs":false}')
      return { workspaceId: 'w1', branch: 'main', displayName: 'repo', terminals: [] }
    })
    try {
      const result = await worker.request('worktrees.browse', { focusedWorkspaceId: 'w1', scope: 'focused' })
      assert.equal(result.spend?.enabled, false)
      assert.equal(result.spend?.total.costUsd, 0)
    } catch (error) {
      assert.match((error as Error).message, /configuration changed|workspace changed|data changed/)
    }
    assert.ok(reads >= 4)
  } finally { await worker.deactivate(); await rm(path, { recursive: true, force: true }) }
})


test('automatic usage needs no pulse config, returns only numbers and revalidates focus', async () => {
  const home = await realpath(await mkdtemp(join(tmpdir(), 'pulse-auto-host-')))
  const usage = new AgentUsageReader(async () => ({ claude: [home], codex: [] }))
  const f = await setup({}, undefined, undefined, undefined, usage)
  try {
    await mkdir(join(f.path, 'openspec/changes'), { recursive: true })
    const canonical = await realpath(f.path)
    const folder = join(home, 'projects', canonical.replace(/[^a-zA-Z0-9-]/g, '-'))
    await mkdir(folder, { recursive: true })
    await writeFile(join(folder, 'session.jsonl'), JSON.stringify({ type: 'assistant', cwd: canonical, message: { id: 'one', model: 'claude-sonnet-5-5', content: [{text:'PRIVATE'}], usage: { input_tokens: 1000, output_tokens: 100 } } }) + '\n')
    const result = await f.worker.request('usage.get', { workspaceId: 'w1', workspaceIds: ['w1', 'w1'] })
    assert.equal(result.spend.total.inputTokens, 1000)
    assert.equal(result.spend.total.knownCosts, 1)
    assert.equal(JSON.stringify(result).includes('PRIVATE'), false)
    await assert.rejects(f.worker.request('usage.get', { workspaceId: 'w1', workspaceIds: ['forged'] }), /workspace changed/)
    const read = usage.read.bind(usage)
    usage.read = async path => {
      const value = await read(path)
      f.host.respond('workspace.readContext', { workspaceId: 'gone', branch: 'main', displayName: 'gone', terminals: [] })
      return value
    }
    await assert.rejects(f.worker.request('usage.get', { workspaceId: 'w1', workspaceIds: ['w1'] }), /workspace changed|workspace is focused/)
    assert.equal(f.host.callsOf('agent.launch').length, 0)
    assert.equal(f.host.callsOf('terminal.sendText').length, 0)
  } finally { await f.worker.deactivate(); await rm(f.path, { recursive: true, force: true }); await rm(home, { recursive: true, force: true }) }
})

test('request locales remain isolated across awaits; own diagnostics translate and external errors stay intact', async () => {
  const { translate } = await import('./i18n')
  const usage = new AgentUsageReader(async () => { throw new Error('EXTERNAL EACCES: /sample/private/session.jsonl') })
  const f = await setup({}, undefined, async path => { await mkdir(join(path, 'openspec/changes'), { recursive: true }) }, undefined, usage)
  try {
    await Promise.all((['en', 'es-ES', 'zh-Hans'] as const).map(async locale => {
      await assert.rejects(f.worker.request('stores.preview', { workspaceId: 'w1', operation: { action: 'invalid' } as any, locale }), error => {
        assert.equal((error as Error).message, translate(locale, 'Unknown store operation.')); return true
      })
      await assert.rejects(f.worker.request('usage.get', { workspaceId: 'w1', workspaceIds: [], locale }), error => {
        assert.equal((error as Error).message, translate(locale, 'Choose 1–32 verified workspaces.')); return true
      })
    }))
    await assert.rejects(f.worker.request('usage.get', { workspaceId: 'w1', workspaceIds: ['w1'], locale: 'zh-Hans' }), /EXTERNAL EACCES: \/sample\/private\/session.jsonl/)
    await assert.rejects(f.worker.request('stores.preview', { workspaceId: 'w1', operation: { action: 'invalid' } as any }), /Unknown store operation/)
    assert.equal(f.host.callsOf('agent.launch').length, 0)
    assert.equal(f.host.callsOf('terminal.sendText').length, 0)
  } finally { await f.worker.deactivate(); await rm(f.path, { recursive: true, force: true }) }
})
