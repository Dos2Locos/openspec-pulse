// Reads openspec/ of the focused workspace, watches it and opens files for the panel.
// Orca transpiles this file when it loads: no build step.
import { execFile } from 'node:child_process'
import { accessSync, constants, watch, type FSWatcher } from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, isAbsolute, join, resolve, sep } from 'node:path'
import { promisify } from 'node:util'
import type { OrcaWorkerApi } from 'orca/worker'
import { ARCHIVE_DIR, CHANGES_DIR, SPECS_DIR, countArchive, countSpecs, fileToOpen, openableFiles, readArchive, readArchivedDetail, readChangeDetail, readChanges, readSpecList, specCapabilities } from './openspec'
import { agentLaunchArgs, buildPrompt, cliError, isAgentAction, isChangeAction, isSafeChangeName, launchedSurface, openPanelArgs, pickIdleClaudeTerminal, pickPluginKey } from './commands'
import type { ChangesState } from './protocol'
import { statusBarSummary } from './state'

const WATCH_DEBOUNCE_MS = 300
const LAUNCH_TIMEOUT_MS = 60_000
const INIT_TIMEOUT_MS = 60_000
const OPEN_PANEL_TIMEOUT_MS = 15_000
// Non-interactive: no AI tool files, only openspec/ (config, specs, changes).
const INIT_ARGS = ['init', '--tools', 'none', '--no-animation', '.']
const run = promisify(execFile)
// shortcut: Orca started from the Dock has a bare PATH (/usr/bin:/bin…), so add the usual user
// install folders; if openspec lives elsewhere, add a setting for its path.
const EXTRA_DIRS = [join(homedir(), '.local', 'bin'), '/opt/homebrew/bin', '/usr/local/bin']
const binaryNames = (name: string): string[] =>
  process.platform === 'win32' ? [`${name}.exe`, `${name}.cmd`] : [name]

/**
 * Absolute path of a CLI, or null. Only absolute folders outside the workspace count: a bare
 * name would let a repository plant its own binary (Windows also searches the cwd).
 */
function resolveBinary(name: string, workspacePath: string, dirs: readonly string[]): string | null {
  const workspace = resolve(workspacePath) + sep
  for (const dir of dirs) {
    if (!dir || !isAbsolute(dir) || (resolve(dir) + sep).startsWith(workspace)) continue
    for (const candidateName of binaryNames(name)) {
      const candidate = join(dir, candidateName)
      try {
        accessSync(candidate, constants.X_OK)
        return candidate
      } catch {
        // not here, keep looking
      }
    }
  }
  return null
}

const pathDirs = (): string[] => (process.env.PATH ?? '').split(delimiter)

export function resolveOpenspec(workspacePath: string): string | null {
  return resolveBinary('openspec', workspacePath, [...pathDirs(), ...EXTRA_DIRS])
}

/**
 * Orca's own CLI. On macOS the worker runs on Orca Helper inside Orca.app, whose launcher is
 * Contents/Resources/bin/orca; elsewhere it must be on PATH.
 */
export function resolveOrcaCli(workspacePath: string): string | null {
  const contents = process.execPath.lastIndexOf('/Contents/')
  const bundled = contents === -1 ? [] : [join(process.execPath.slice(0, contents), 'Contents', 'Resources', 'bin')]
  return resolveBinary('orca', workspacePath, [...bundled, ...pathDirs()])
}

const STATUS_ITEM = 'summary'

const WSL_PREFIXES = ['\\\\wsl.localhost\\', '\\\\wsl$\\', '//wsl.localhost/']

/** An error whose `code` reaches the panel as is (any other becomes `action_failed`). */
function hostError(code: string, message: string): Error {
  return Object.assign(new Error(message), { code })
}

type Workspace = { id: string; name: string; path: string; isLocal: boolean }

async function focusedWorkspace(orca: OrcaWorkerApi): Promise<Workspace | null> {
  const context = await orca.host.call('workspace.readContext', {})
  if (!context?.workspaceId) return null
  const { workspaces } = await orca.host.call('workspace.list', {})
  const row = workspaces.find((w) => w.id === context.workspaceId)
  if (!row) return null
  const lowerPath = row.path.toLowerCase()
  const isLocal =
    (row.hostId === 'local' || row.hostId === null) &&
    !WSL_PREFIXES.some((prefix) => lowerPath.startsWith(prefix))
  return { id: row.id, name: row.name, path: row.path, isLocal }
}

// Module state so deactivate() can close the watcher when Orca stops the worker.
let watcher: FSWatcher | null = null
let watchedDir: string | null = null
let debounce: ReturnType<typeof setTimeout> | undefined

export function deactivate(): void {
  clearTimeout(debounce)
  watcher?.close()
  watcher = null
  watchedDir = null
}

export default function activate(orca: OrcaWorkerApi): void {
  /** The last summary sent to the status bar, as JSON, so repeats are skipped. */
  let lastStatus: string | null = null

  function watchChanges(dir: string | null): void {
    if (dir === watchedDir) return
    watcher?.close()
    watcher = null
    watchedDir = dir
    if (!dir) return
    try {
      watcher = watch(dir, { recursive: true }, () => {
        clearTimeout(debounce)
        debounce = setTimeout(() => {
          orca.panels.post('changes.changed', {})
          void refreshStatus()
        }, WATCH_DEBOUNCE_MS)
      })
      watcher.on('error', (error) => {
        orca.log(`watch ${dir} stopped: ${error.message}`)
        watchChanges(null)
      })
    } catch (error) {
      // The refresh button still works without a watcher.
      orca.log(`cannot watch ${dir}: ${(error as Error).message}`)
      watchedDir = null
    }
  }

  async function publishStatus(list: ChangesState): Promise<void> {
    const summary = statusBarSummary(list)
    const key = JSON.stringify(summary)
    if (key === lastStatus) return
    try {
      await orca.host.call('statusBar.update', { id: STATUS_ITEM, ...summary })
      lastStatus = key
    } catch (error) {
      orca.log(`statusBar.update failed: ${(error as Error).message}`)
    }
  }

  /** Lists the changes and updates the status bar item; every list goes through here. */
  async function listChanges(): Promise<ChangesState> {
    const list = await readFocusedChanges()
    await publishStatus(list)
    return list
  }

  /** For the status bar alone, with no panel waiting: errors only reach the log. */
  async function refreshStatus(): Promise<void> {
    try {
      await listChanges()
    } catch (error) {
      orca.log(`cannot list changes: ${(error as Error).message}`)
    }
  }

  async function readFocusedChanges(): Promise<ChangesState> {
    const workspace = await focusedWorkspace(orca)
    if (!workspace) {
      watchChanges(null)
      return { status: 'no-workspace' }
    }
    if (!workspace.isLocal) {
      watchChanges(null)
      return { status: 'remote', workspace: workspace.name }
    }
    const changes = await readChanges(workspace.path)
    // The whole openspec/ folder: archive moves and spec edits must refresh the tabs too.
    watchChanges(changes ? join(workspace.path, 'openspec') : null)
    if (!changes) return { status: 'no-openspec', workspace: workspace.name }
    const [archived, specs] = await Promise.all([countArchive(workspace.path), countSpecs(workspace.path)])
    return { status: 'ok', workspace: workspace.name, changes, archived, specs }
  }

  orca.panels.handle('changes.list', listChanges)
  // With the panel closed too: the status bar follows the focused workspace.
  orca.events.on('workspace.changed', () => refreshStatus())
  void refreshStatus()

  // The status bar item's press. No host call opens a panel; Orca's CLI does.
  orca.commands.register('openspec-pulse.showPanel', async () => {
    try {
      await openPanel()
    } catch (error) {
      const err = error as Error & { stdout?: string }
      orca.log(`cannot open the panel: ${cliError(err.stdout) ?? err.message}`)
    }
  })

  async function openPanel(): Promise<void> {
    const workspace = await focusedWorkspace(orca)
    // The CLI is looked up outside the workspace, like for chats; without one, any folder will do.
    const cli = resolveOrcaCli(workspace?.path ?? homedir())
    if (!cli) throw new Error('Orca CLI not found.')
    const { stdout } = await run(cli, ['plugin', 'list', '--json'], { timeout: OPEN_PANEL_TIMEOUT_MS })
    const key = pickPluginKey(stdout)
    if (!key) throw new Error('openspec-pulse is not running or idle in `orca plugin list`.')
    await run(cli, openPanelArgs(key), { timeout: OPEN_PANEL_TIMEOUT_MS })
  }

  orca.panels.handle('changes.detail', async ({ name }) => {
    const workspace = await focusedWorkspace(orca)
    return workspace?.isLocal ? readChangeDetail(workspace.path, name) : null
  })

  orca.panels.handle('archive.list', async () => {
    const workspace = await focusedWorkspace(orca)
    return workspace?.isLocal ? readArchive(workspace.path) : []
  })

  orca.panels.handle('archive.detail', async ({ folder }) => {
    const workspace = await focusedWorkspace(orca)
    return workspace?.isLocal ? readArchivedDetail(workspace.path, folder) : null
  })

  orca.panels.handle('specs.list', async () => {
    const workspace = await focusedWorkspace(orca)
    return workspace?.isLocal ? readSpecList(workspace.path) : []
  })

  orca.panels.handle('specs.open', async ({ capability }) => {
    const workspace = await focusedWorkspace(orca)
    // Only a capability that is listed on disk: the panel's input is never trusted as a path.
    if (!workspace?.isLocal || !(await specCapabilities(workspace.path)).includes(capability)) return { opened: false }
    await orca.host.call('editor.open', { workspaceId: workspace.id, path: join(SPECS_DIR, capability, 'spec.md') })
    return { opened: true }
  })

  orca.panels.handle('openspec.init', async () => {
    const workspace = await focusedWorkspace(orca)
    if (!workspace?.isLocal) return listChanges()
    const binary = resolveOpenspec(workspace.path)
    if (!binary) {
      throw new Error(
        'openspec CLI not found in ~/.local/bin, /opt/homebrew/bin, /usr/local/bin or PATH. ' +
          'Install it with: npm install -g @fission-ai/openspec'
      )
    }
    try {
      await run(binary, INIT_ARGS, { cwd: workspace.path, timeout: INIT_TIMEOUT_MS })
    } catch (error) {
      const err = error as Error & { stderr?: string }
      const reason = err.stderr?.trim() || err.message
      orca.log(`openspec init in ${workspace.path} failed: ${reason}`)
      throw new Error(`openspec init failed: ${reason}`)
    }
    return listChanges()
  })

  orca.panels.handle('agent.run', async ({ action, change, prompt }) => {
    if (!isAgentAction(action)) throw hostError('invalid_params', `unknown action ${String(action)}`)
    const workspace = await focusedWorkspace(orca)
    if (!workspace) throw hostError('unavailable', 'No workspace is focused.')
    // The change name goes into the agent's prompt: only accept one that exists on disk.
    if (isChangeAction(action)) {
      const known = workspace.isLocal && isSafeChangeName(change) && (await readChangeDetail(workspace.path, change))
      if (!known) throw hostError('invalid_params', `No active change named ${String(change)}.`)
    }
    const built = buildPrompt(action, { change, prompt })
    if ('error' in built) throw hostError('invalid_params', built.error)
    return (await sendToIdleTerminal(built.prompt)) ?? launchChat(workspace.path, built.prompt)
  })

  /** Types the prompt into an idle Claude Code terminal of the focused workspace, if there is one. */
  async function sendToIdleTerminal(prompt: string): Promise<{ surface: 'open-terminal' } | null> {
    const { agents } = await orca.host.call('agents.list', {})
    const terminalId = pickIdleClaudeTerminal(agents)
    if (!terminalId) {
      orca.log(`no idle Claude Code terminal (${agents.map((a) => `${a.agent}:${a.state}:${a.terminalId ?? 'no-terminal'}`).join(', ')}); opening a chat`)
      return null
    }
    // A newline would submit the TUI's input early: send the prompt as one line.
    const { accepted } = await orca.host.call('terminal.sendText', {
      terminalId,
      text: prompt.replace(/\s*\n\s*/g, ' '),
      enter: true
    })
    if (!accepted) {
      orca.log(`terminal ${terminalId} did not accept the prompt; opening a chat`)
      return null
    }
    await orca.host.call('terminal.focus', { terminalId })
    return { surface: 'open-terminal' }
  }

  /**
   * A new Claude chat, shown in the current window. The host API's agent.launch only opens a
   * background terminal, so this runs Orca's CLI; execFile with an argument list, so the prompt is
   * never parsed by a shell.
   */
  async function launchChat(workspacePath: string, prompt: string): Promise<{ surface: 'chat' | 'terminal' }> {
    const cli = resolveOrcaCli(workspacePath)
    if (!cli) throw hostError('unavailable', 'Orca CLI not found.')
    try {
      const { stdout } = await run(cli, agentLaunchArgs(workspacePath, prompt), { timeout: LAUNCH_TIMEOUT_MS })
      return { surface: launchedSurface(stdout) }
    } catch (error) {
      const err = error as Error & { stdout?: string }
      const reason = cliError(err.stdout) ?? err.message
      orca.log(`orca agent launch failed: ${reason}`)
      throw new Error(`Could not start Claude: ${reason}`)
    }
  }

  orca.panels.handle('changes.open', async ({ name, file, archived }) => {
    const workspace = await focusedWorkspace(orca)
    if (!workspace?.isLocal) return { opened: false }
    // Only open files that exist in that change: the panel's input is never trusted as a path.
    const detail = archived ? await readArchivedDetail(workspace.path, name) : await readChangeDetail(workspace.path, name)
    const target = detail && (file ?? fileToOpen(detail))
    if (!detail || !target || !openableFiles(detail).includes(target)) return { opened: false }
    await orca.host.call('editor.open', {
      workspaceId: workspace.id,
      // editor.open wants a path relative to the workspace root.
      path: join(archived ? ARCHIVE_DIR : CHANGES_DIR, name, target)
    })
    return { opened: true }
  })
}
