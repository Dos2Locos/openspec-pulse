import { assert, test, mockHost, mountWorker } from 'orca/testing'
import { mkdtemp, mkdir, readFile, rm, writeFile, symlink, rename, realpath } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { StoreReader } from './store-reader'
import { inStoreScope, parseStoreList, patchStore, storeDeclaration, storePrefixes, storeScopeKey } from './stores'

test('store scalars preserve unrelated YAML bytes, comments and CRLF on link and unlink', () => {
  for (const eol of ['\n', '\r\n']) {
    const before = ['# project', 'schema: spec-driven # keep', 'store: "shared" # store note', 'context: |', '  store: prose', 'unknown: { nested: [one, two] }', ''].join(eol)
    const linked = patchStore(before, 'other')
    assert.equal(linked, before.replace('store: "shared"', 'store: other'))
    assert.equal(patchStore(linked, null), before.replace(`store: "shared" # store note${eol}`, `# store note${eol}`))
  }
  assert.equal(patchStore('schema: x', 'shared'), 'schema: x\nstore: shared\n')
  assert.equal(patchStore('# only\n', null), '# only\n')
  for (const yaml of ['store: [x]\n', 'store: x\nstore: y\n', 'store: ../x', '"store": x', '<<: *defaults']) assert.throws(() => storeDeclaration(yaml))
  assert.deepEqual(storePrefixes(['billing-', 'billing-', 'identity/']), ['billing-', 'identity/'])
  assert.throws(() => storePrefixes(['../x']))
  assert.equal(inStoreScope('billing-invoice', ['billing-']), true)
  assert.equal(inStoreScope('identity-login', ['billing-']), false)
  assert.notEqual(storeScopeKey('a', '/same'), storeScopeKey('b', '/same'))
  for (const text of ['{}', '{"stores":[{"id":"x","root":"relative"}],"status":[]}', '{"stores":[{"id":"../x","root":"/tmp"}],"status":[]}']) assert.throws(() => parseStoreList(text))
})

export async function storeFixture() {
  const base = await realpath(await mkdtemp(join(tmpdir(), 'pulse-stores-')))
  const workspace = join(base, 'workspace'), shared = join(base, 'shared'), other = join(base, 'other')
  await mkdir(join(workspace, 'openspec'), { recursive: true })
  await writeFile(join(workspace, 'openspec/config.yaml'), 'schema: spec-driven\nstore: shared # note\ncontext: keep\n')
  for (const path of [shared, other]) {
    await mkdir(join(path, 'openspec/changes'), { recursive: true })
    await mkdir(join(path, 'openspec/specs'), { recursive: true })
    await writeFile(join(path, 'openspec/config.yaml'), 'schema: spec-driven\n')
  }
  let version = '1.14.1'
  const rows = [{ id: 'shared', root: shared }, { id: 'other', root: other }]
  const calls: string[][] = []
  const reader = new StoreReader(async (_binary, args) => {
    calls.push(args)
    if (args[0] === '--version') return version
    if (args.includes('--help')) return '--path --no-init-git --json'
    if (args[0] === 'store' && args[1] === 'list') return JSON.stringify({ stores: rows, status: [] })
    if (args[0] === 'list') { const id = args[args.indexOf('--store') + 1]; return JSON.stringify({ root: { path: rows.find(row => row.id === id)?.root, store_id: id } }) }
    if (args[1] === 'setup') { await mkdir(args[args.indexOf('--path') + 1]); return '{}' }
    throw new Error('Unexpected CLI call')
  })
  return { base, workspace, shared, other, reader, calls, rows, version: (value: string) => { version = value }, cleanup: () => rm(base, { recursive: true, force: true }) }
}

test('worker shares store readers, isolates system scopes, blocks agents and replaces watchers on relink', async () => {
  const f = await storeFixture()
  for (const [root, name] of [[f.shared, 'billing-one'], [f.shared, 'identity-two'], [f.other, 'other-three']]) {
    await mkdir(join(root, 'openspec/changes', name, 'specs', name), { recursive: true })
    await writeFile(join(root, 'openspec/changes', name, 'tasks.md'), '- [ ] pending\n')
    await writeFile(join(root, 'openspec/changes', name, 'specs', name, 'spec.md'), '# Delta')
    await mkdir(join(root, 'openspec/specs', name), { recursive: true })
    await writeFile(join(root, 'openspec/specs', name, 'spec.md'), '# Spec')
  }
  const host = mockHost({ results: {
    'workspace.readContext': { workspaceId: 'w', branch: 'main', displayName: 'repo', terminals: [] },
    'workspace.list': { workspaces: [{ id: 'w', kind: 'folder', name: 'repo', path: f.workspace, branch: null, hostId: 'local' }], truncated: false },
    'statusBar.update': { ok: true }
  } })
  const module = await import('./worker')
  let storage!: import('orca/worker').OrcaWorkerApi['storage']
  const worker = await mountWorker({ ...module, default: api => { storage = api.storage; module.default(api, undefined, f.reader) } }, { host })
  try {
    const list = await worker.request('changes.list')
    assert.ok(list.status === 'ok' && list.root?.storeId === 'shared' && list.changes.every(change => change.readOnly))
    const info = await worker.request('stores.info', { workspaceId: 'w' })
    assert.equal(info.root?.dataPath, f.shared)
    await worker.request('stores.scope.set', { workspaceId: 'w', fingerprint: info.root!.fingerprint, prefixes: ['billing-'] })
    const snapshot = await worker.request('worktrees.browse', { focusedWorkspaceId: 'w', scope: 'focused' })
    assert.ok(snapshot.list.status === 'ok' && snapshot.list.changes.length === 1 && snapshot.list.changes[0].name === 'billing-one')
    assert.equal(snapshot.specs.length, 1)
    const delivery = await worker.request('delivery.get', { workspaceId: 'w', names: ['billing-one'] })
    assert.equal(delivery.configured, false)
    await assert.rejects(worker.request('delivery.get', { workspaceId: 'w', names: ['identity-two'] }), /disappeared/)
    assert.equal(await worker.request('changes.detail', { workspaceId: 'w', name: 'identity-two' }), null)
    const detail = await worker.request('changes.detail', { workspaceId: 'w', name: 'billing-one' })
    assert.equal(detail?.readOnly, true)
    assert.equal((await worker.request('artifacts.read', { workspaceId: 'w', name: 'billing-one', file: 'tasks.md' }))?.markdown, '- [ ] pending\n')
    await assert.rejects(worker.request('agent.run', { workspaceId: 'w', action: 'apply', change: 'billing-one' }), /explicit execution association/)
    await assert.rejects(worker.request('agent.run', { workspaceId: 'w', action: 'propose', prompt: 'new' }), /explicit execution association/)
    await assert.rejects(worker.request('stores.scope.set', { workspaceId: 'w', fingerprint: info.root!.fingerprint, prefixes: [] }), /changed/)
    const cancelledByFocus = await worker.request('stores.preview', { workspaceId: 'w', operation: { action: 'unlink' } })
    const configBefore = await readFile(join(f.workspace, 'openspec/config.yaml'), 'utf8')
    let contextReads = 0
    host.respond('workspace.readContext', () => ({ workspaceId: ++contextReads === 1 ? 'w' : 'gone', branch: 'main', displayName: 'repo', terminals: [] }))
    await assert.rejects(worker.request('stores.commit', { workspaceId: 'w', token: cancelledByFocus.token }), /workspace changed/)
    assert.equal(await readFile(join(f.workspace, 'openspec/config.yaml'), 'utf8'), configBefore)
    host.respond('workspace.readContext', { workspaceId: 'w', branch: 'main', displayName: 'repo', terminals: [] })
    const preview = await worker.request('stores.preview', { workspaceId: 'w', operation: { action: 'link', id: 'other' } })
    const results = await Promise.allSettled([
      worker.request('stores.commit', { workspaceId: 'w', token: preview.token }),
      worker.request('stores.commit', { workspaceId: 'w', token: preview.token })
    ])
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
    const changed = await worker.request('changes.list')
    assert.ok(changed.status === 'ok' && changed.root?.storeId === 'other' && changed.changes[0]?.name === 'other-three')
    // A late read of an old name cannot return an object from the previous root.
    assert.equal(await worker.request('changes.detail', { workspaceId: 'w', name: 'billing-one' }), null)
    const posts = worker.posts.length
    await writeFile(join(f.other, 'openspec/changes/other-three/tasks.md'), '- [x] pending\n')
    for (let i = 0; i < 40 && worker.posts.length === posts; i++) await new Promise(resolve => setTimeout(resolve, 50))
    assert.ok(worker.posts.length > posts)
    await worker.request('changes.list')
    await new Promise(resolve => setTimeout(resolve, 400))
    const after = worker.posts.length
    await writeFile(join(f.shared, 'openspec/changes/billing-one/tasks.md'), '- [x] pending\n')
    await new Promise(resolve => setTimeout(resolve, 450))
    assert.equal(worker.posts.length, after)
    const secondWorkspace = join(f.base, 'workspace2')
    await mkdir(join(secondWorkspace, 'openspec'), { recursive: true })
    await writeFile(join(secondWorkspace, 'openspec/config.yaml'), 'store: shared\n')
    host.respond('workspace.readContext', { workspaceId: 'w2', branch: 'main', displayName: 'repo2', terminals: [] })
    host.respond('workspace.list', { workspaces: [{ id: 'w2', kind: 'folder', name: 'repo2', path: secondWorkspace, branch: null, hostId: 'local' }], truncated: false })
    const second = await worker.request('stores.info', { workspaceId: 'w2' })
    assert.deepEqual(second.root?.prefixes, [])
    assert.deepEqual((await storage.get(storeScopeKey('w', f.shared)) as { prefixes: string[] }).prefixes, ['billing-'])
    await assert.rejects(worker.request('stores.commit', { workspaceId: 'w', token: preview.token }), /focused workspace changed/)
    assert.equal(host.callsOf('terminal.sendText').length, 0)
    assert.equal(host.callsOf('agent.launch').length, 0)
    assert.equal(host.callsOf('editor.open').length, 0)
  } finally { await worker.deactivate(); await f.cleanup() }
})

test('resolver checks the tested CLI contract, registered identity and real roots without fallbacks', async () => {
  const f = await storeFixture()
  try {
    const root = await f.reader.resolve(f.workspace, '/cli', ['billing-'])
    assert.equal(root.kind, 'store'); assert.equal(root.dataPath, f.shared)
    assert.deepEqual(root.prefixes, ['billing-'])
    await assert.rejects(f.reader.resolve(f.workspace, null), /unavailable/)
    await assert.rejects(new StoreReader(async (_binary, args) => args[0] === '--version' ? '1.14.1' : 'Usage: no stores here').catalog(f.workspace, '/cli'), /does not offer/)
    f.version('2.1.0')
    await assert.rejects(f.reader.resolve(f.workspace, '/cli'), /tested OpenSpec 1.14.1/)
    f.version('1.14.1')
    await writeFile(join(f.workspace, 'openspec/config.yaml'), 'store: unknown\n')
    await assert.rejects(f.reader.resolve(f.workspace, '/cli'), /Unknown store 'unknown'/)
    await writeFile(join(f.workspace, 'openspec/config.yaml'), 'store: shared\n')
    f.rows[0].root = join(f.base, 'missing')
    await assert.rejects(f.reader.resolve(f.workspace, '/cli'))
    f.rows[0].root = f.shared
    await rename(f.shared, f.shared + '-old')
    await mkdir(join(f.shared, 'openspec'), { recursive: true })
    assert.notEqual((await f.reader.resolve(f.workspace, '/cli', ['billing-'])).fingerprint, root.fingerprint)
    await mkdir(join(f.workspace, 'openspec/changes'))
    const local = await f.reader.resolve(f.workspace, null)
    assert.equal(local.kind, 'local'); assert.ok(local.diagnostics[0].includes('takes precedence'))
    await writeFile(join(f.workspace, 'openspec/config.yaml'), 'store: [ambiguous]\n')
    assert.equal((await f.reader.resolve(f.workspace, null)).kind, 'local')
    await rm(join(f.workspace, 'openspec/config.yaml'))
    await symlink(join(f.other, 'openspec/config.yaml'), join(f.workspace, 'openspec/config.yaml'))
    await assert.rejects(f.reader.resolve(f.workspace, '/cli'), /real file/)
  } finally { await f.cleanup() }
})

test('management previews have no effects; commits preserve config and reject stale, duplicate or unauthorized consent', async () => {
  const f = await storeFixture()
  const file = join(f.workspace, 'openspec/config.yaml')
  const validate = async () => undefined
  try {
    const fixture = await readFile(new URL('../fixtures/stores/workspace/openspec/config.yaml', import.meta.url), 'utf8')
    assert.equal(patchStore(fixture, null), fixture.replace('store: shared # shared planning\n', '# shared planning\n'))
    assert.equal(parseStoreList(await readFile(new URL('../fixtures/stores/list.json', import.meta.url), 'utf8')).length, 2)
    const initial = await readFile(file, 'utf8')
    await f.reader.preview('w', f.workspace, '/cli', { action: 'create', id: 'new', path: join(f.base, 'new') })
    assert.equal(f.calls.some(args => args[1] === 'setup' && !args.includes('--help')), false)
    const unlink = await f.reader.preview('w', f.workspace, '/cli', { action: 'unlink' })
    assert.equal(await readFile(file, 'utf8'), initial)
    await f.reader.commit('w', f.workspace, '/cli', unlink.token, validate)
    assert.equal(await readFile(file, 'utf8'), 'schema: spec-driven\n# note\ncontext: keep\n')
    await assert.rejects(f.reader.commit('w', f.workspace, '/cli', unlink.token, validate), /expired/)
    const link = await f.reader.preview('w', f.workspace, '/cli', { action: 'link', id: 'other' })
    await f.reader.commit('w', f.workspace, '/cli', link.token, validate)
    assert.equal(storeDeclaration(await readFile(file, 'utf8')).id, 'other')
    const stale = await f.reader.preview('w', f.workspace, '/cli', { action: 'unlink' })
    await writeFile(file, initial + '# edited\n')
    await assert.rejects(f.reader.commit('w', f.workspace, '/cli', stale.token, validate), /changed/)
    const blocked = await f.reader.preview('w', f.workspace, '/cli', { action: 'unlink' })
    await assert.rejects(f.reader.commit('w', f.workspace, '/cli', blocked.token, async () => { throw new Error('focus changed') }), /focus changed/)
    assert.equal(await readFile(file, 'utf8'), initial + '# edited\n')
    const create = await f.reader.preview('w', f.workspace, '/cli', { action: 'create', id: 'new', path: join(f.base, 'new') })
    await f.reader.commit('w', f.workspace, '/cli', create.token, validate)
    assert.ok(f.calls.find(args => args[1] === 'setup' && !args.includes('--help'))?.includes('--no-init-git'))
    assert.equal(f.calls.some(args => args.includes('--remote')), false)
    for (const path of ['relative', f.shared, '/']) await assert.rejects(f.reader.preview('w', f.workspace, '/cli', { action: 'create', id: 'new', path }))
  } finally { await f.cleanup() }
})
