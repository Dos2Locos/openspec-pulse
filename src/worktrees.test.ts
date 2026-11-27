import { mkdtemp, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { assert, test } from 'orca/testing'
import { gitIdentity, isLocalWorkspace, sameRepository } from './worktrees'
import { worktreeItemKey } from './worktree-key'

const run = promisify(execFile)
test('Git common directory resolves symlinks; detached HEAD remains readable; failures are explicit', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pulse-git-'))
  const alias = dir + '-alias'
  try {
    await run('/usr/bin/git', ['init', '-b', 'main', dir])
    await run('/usr/bin/git', ['-C', dir, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--allow-empty', '-m', 'fixture'])
    await symlink(dir, alias)
    const original = await gitIdentity(dir, '/usr/bin/git')
    assert.deepEqual(await gitIdentity(alias, '/usr/bin/git'), original)
    await run('/usr/bin/git', ['-C', dir, 'checkout', '--detach'])
    assert.equal((await gitIdentity(dir, '/usr/bin/git')).branch, null)
    await assert.rejects(gitIdentity(dir, '/nonexistent/git'))
    await assert.rejects(gitIdentity(dir + '-deleted', '/usr/bin/git'))
    assert.equal(sameRepository(original, { ...original, commonDir: '/other/.git' }), false)
    assert.equal(sameRepository(original, { ...original, root: '/other' }), true)
  } finally { await rm(alias, { force: true }); await rm(dir, { recursive: true, force: true }) }
})

test('remote, WSL and relative workspaces are excluded; composite item identities do not collide', () => {
  for (const row of [{ path: '/repo', hostId: 'ssh' }, { path: '//wsl.localhost/Ubuntu/repo', hostId: 'local' },
    { path: '\\\\wsl$\\Ubuntu\\repo', hostId: 'local' }, { path: 'relative/repo', hostId: null }]) assert.equal(isLocalWorkspace(row), false)
  assert.equal(isLocalWorkspace({ path: '/repo', hostId: null }), true)
  assert.notEqual(worktreeItemKey('w1', 'active', 'same'), worktreeItemKey('w2', 'active', 'same'))
  assert.notEqual(worktreeItemKey('w1', 'active', 'same'), worktreeItemKey('w1', 'archive', 'same'))
})
