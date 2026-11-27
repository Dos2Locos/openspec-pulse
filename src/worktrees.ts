import { t } from './i18n'
// Git identity is filesystem identity, never a branch name or a repository label.
import { execFile } from 'node:child_process'
import { realpath } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)
export type RegisteredWorkspace = { id: string; name: string; path: string; hostId: string | null; branch: string | null }
export type GitIdentity = { root: string; commonDir: string; branch: string | null }

export function isLocalWorkspace(row: Pick<RegisteredWorkspace, 'path' | 'hostId'>): boolean {
  return (row.hostId === null || row.hostId === 'local') && isAbsolute(row.path) &&
    !/^(?:\\\\wsl(?:\.localhost|\$)\\|\/\/wsl(?:\.localhost|\$)\/)/i.test(row.path)
}

/** Bounded, read-only Git commands; no shell, prompts, hooks or workspace executable. */
export async function gitIdentity(path: string, binary: string): Promise<GitIdentity> {
  const root = await realpath(path)
  const git = async (...args: string[]): Promise<string> => {
    const { stdout } = await run(binary, ['-C', root, 'rev-parse', ...args], {
      timeout: 3000, maxBuffer: 64 * 1024,
      env: { ...process.env, GIT_DIR: undefined, GIT_WORK_TREE: undefined, GIT_COMMON_DIR: undefined, GIT_INDEX_FILE: undefined, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' }
    })
    return stdout.trim()
  }
  const top = await realpath(await git('--show-toplevel'))
  if (top !== root) throw new Error(t('Workspace is not a Git worktree root.'))
  const commonDir = await realpath(resolve(root, await git('--git-common-dir')))
  const branch = await git('--abbrev-ref', 'HEAD').catch(() => 'HEAD')
  return { root, commonDir, branch: branch === 'HEAD' ? null : branch }
}

export function sameRepository(a: GitIdentity, b: GitIdentity): boolean {
  return a.commonDir === b.commonDir
}
