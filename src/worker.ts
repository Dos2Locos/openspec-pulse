import { t } from './i18n'
import { AsyncLocalStorage } from 'node:async_hooks'
import { configureLocaleProvider, resolveLocale, type Locale } from './i18n'
import type { PluginRequests, PluginRequestInput, PluginRequestOutput } from 'orca/host'
import { AgentUsageReader } from './usage-reader'
import { summarizeUsage, type UsageRead } from './usage'
import { readSpendSources, combineSpend } from './spend-reader'
import { StoreReader, scopeEntries } from './store-reader'
import { inStoreScope, storePrefixes, storeScopeKey, STORE_VERSION, type OpenSpecRoot } from './stores'
import { GithubDelivery } from './github'
import { LOGIN, requiredLogin, ticketFor, type DeliverySnapshot } from './delivery'
import { readWorkflow } from './config-reader'
// Reads openspec/ of the focused workspace, watches it and opens files for the panel.
// Orca transpiles this file when it loads: no build step.
import { execFile } from 'node:child_process'
import { accessSync, constants, watch, type FSWatcher } from 'node:fs'
import { readFile, realpath, mkdir, lstat, writeFile, open } from 'node:fs/promises'
import { BOARD_PATH, boardMarker, markerWorkspace } from './board/model'
import { homedir } from 'node:os'
import { delimiter, isAbsolute, join, resolve, sep } from 'node:path'
import { promisify } from 'node:util'
import type { OrcaWorkerApi } from 'orca/worker'
import { ARCHIVE_DIR, CHANGES_DIR, SPECS_DIR, fileToOpen, openableFiles, readArchive, readArchivedDetail, readChangeDetail, readChanges, readSpecList, readRelationEntries, parseSpec, resolveTask, specCapabilities } from './openspec'
import { agentLaunchArgs, buildPrompt, checkModel, cliError, isAgentAction, isChangeAction, isProfileId, isSafeChangeName, isTarget, launchedSurface, listProfiles, listSessions, openPanelArgs, pickIdleTerminal, pickPluginKey, profileInfo, readPrefs, sessionProblem } from './commands'
import type { AgentOptions, AgentPrefs, AgentTarget, ChangeRef, ChangesState, ProfileId, BrowseSnapshot, WorktreeOrigin } from './protocol'
import { buildRelations, relatedChanges, RelationCache } from './relations'
import { gitIdentity, isLocalWorkspace, sameRepository, type GitIdentity } from './worktrees'
import { statusBarSummary } from './state'

const requestLocale = new AsyncLocalStorage<Locale>()
configureLocaleProvider(() => requestLocale.getStore() ?? 'en')

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

/** An error whose `code` reaches the panel as is (any other becomes `action_failed`). */
function hostError(code: string, message: string): Error {
  return Object.assign(new Error(message), { code })
}

type Workspace = { id: string; name: string; path: string; isLocal: boolean; executionPath?: string; specRoot?: OpenSpecRoot }

async function focusedWorkspace(orca: OrcaWorkerApi): Promise<Workspace | null> {
  const context = await orca.host.call('workspace.readContext', {})
  if (!context?.workspaceId) return null
  const { workspaces } = await orca.host.call('workspace.list', {})
  const row = workspaces.find((w) => w.id === context.workspaceId)
  if (!row) return null
  return { id: row.id, name: row.name, path: row.path, isLocal: isLocalWorkspace(row) }
}

// Module state so deactivate() can close the watcher when Orca stops the worker.
let watcher: FSWatcher | null = null
let watchedDir: string | null = null
let configWatcher: FSWatcher | null = null
let watchedConfig: string | null = null
let debounce: ReturnType<typeof setTimeout> | undefined
let activationGeneration = 0

export function deactivate(): void {
  activationGeneration++
  clearTimeout(debounce)
  watcher?.close()
  watcher = null
  watchedDir = null
  configWatcher?.close()
  configWatcher = null
  watchedConfig = null
}

export default function activate(orca: OrcaWorkerApi, delivery = new GithubDelivery(), stores = new StoreReader(async (binary, args, cwd) => (await run(binary, args, { cwd, timeout: 15_000, maxBuffer: 512 * 1024 })).stdout), usage = new AgentUsageReader()): void {
  const activation = ++activationGeneration
  async function dataRoot(workspace: Workspace): Promise<OpenSpecRoot> {
    const root = await stores.resolve(workspace.path, resolveOpenspec(workspace.path))
    if (root.kind !== 'store') return root
    const prefs = await orca.storage.get(storeScopeKey(workspace.id, root.dataPath)) as { v?: unknown; prefixes?: unknown } | null
    const prefixes = prefs?.v === 1 ? storePrefixes(prefs.prefixes) : []
    return { ...root, prefixes, fingerprint: JSON.stringify([root.fingerprint, prefixes]) }
  }
  async function dataWorkspace(workspace: Workspace): Promise<Workspace> {
    const specRoot = await dataRoot(workspace)
    return { ...workspace, executionPath: workspace.path, path: specRoot.kind === 'store' ? specRoot.dataPath : workspace.path, specRoot }
  }
  async function focusedLocal(id: string): Promise<Workspace> {
    const workspace = await focusedWorkspace(orca)
    if (!workspace?.isLocal || workspace.id !== id) throw hostError('workspace_changed', t("The focused workspace changed."))
    return workspace
  }
  let managingStore = false
  function handle<K extends keyof PluginRequests>(name: K, handler: (input: PluginRequestInput<K>) => PluginRequestOutput<K> | Promise<PluginRequestOutput<K>>): void {
    orca.panels.handle(name, input => requestLocale.run(resolveLocale((input as { locale?: unknown } | undefined)?.locale), () => handler(input)))
  }
  handle('stores.info', async ({ workspaceId }) => {
    const workspace = await focusedWorkspace(orca)
    if (!workspace || workspace.id !== workspaceId) throw hostError('workspace_changed', t("The focused workspace changed."))
    if (!workspace.isLocal) return { local: false, workspaceId, root: null, stores: [], error: t("Stores require a local workspace."), version: null }
    let root: OpenSpecRoot | null = null, error: string | null = null
    let catalog: import('./stores').RegisteredStore[] = []
    let version: string | null = null
    try { root = await dataRoot(workspace) } catch (reason) { error = (reason as Error).message }
    try { catalog = await stores.catalog(workspace.path, resolveOpenspec(workspace.path)); version = STORE_VERSION }
    catch (reason) { error = [error, (reason as Error).message].filter(Boolean).join(' ') }
    const current = await focusedLocal(workspaceId)
    if (current.path !== workspace.path) throw hostError('workspace_changed', t("The workspace changed."))
    return { local: true, workspaceId, root, stores: catalog, error, version }
  })
  handle('stores.preview', async ({ workspaceId, operation }) => {
    const workspace = await focusedLocal(workspaceId)
    const preview = await stores.preview(workspaceId, workspace.path, resolveOpenspec(workspace.path), operation)
    const after = await focusedLocal(workspaceId)
    if (after.path !== workspace.path) throw hostError('workspace_changed', t("The workspace changed."))
    return preview
  })
  handle('stores.commit', async ({ workspaceId, token }) => {
    if (managingStore) throw hostError('busy', t("Another store operation is in progress."))
    managingStore = true
    try {
      const workspace = await focusedLocal(workspaceId)
      const root = await realpath(workspace.path)
      await stores.commit(workspaceId, workspace.path, resolveOpenspec(workspace.path), token, async () => {
        const current = await focusedLocal(workspaceId)
        if (current.path !== workspace.path || await realpath(current.path) !== root) throw hostError('workspace_changed', t("The workspace changed; nothing was written."))
      })
      invalidateRelations()
      watchChanges(null)
      orca.panels.post('changes.changed', {})
      await refreshStatus()
      return { saved: true }
    } finally { managingStore = false }
  })
  handle('stores.scope.set', async ({ workspaceId, fingerprint, prefixes }) => {
    if (managingStore) throw hostError('busy', t("Another store operation is in progress."))
    managingStore = true
    try {
      const checked = storePrefixes(prefixes)
      const workspace = await focusedLocal(workspaceId)
      const root = await dataRoot(workspace)
      if (root.kind !== 'store' || root.fingerprint !== fingerprint) throw hostError('workspace_changed', t("The store root or scope changed. Refresh first."))
      const key = storeScopeKey(workspaceId, root.dataPath)
      const previous = await orca.storage.get(key)
      const current = await focusedLocal(workspaceId)
      if (current.path !== workspace.path || (await dataRoot(current)).fingerprint !== fingerprint) throw hostError('workspace_changed', t("The store root or scope changed."))
      const kept = previous && typeof previous === 'object' && !Array.isArray(previous) ? previous : {}
      await orca.storage.set(key, { ...kept, v: 1, prefixes: checked })
      invalidateRelations()
      orca.panels.post('changes.changed', {})
      await refreshStatus()
      return { saved: true }
    } finally { managingStore = false }
  })

  let openingBoard = false
  async function openBoard(expectedId?: string): Promise<{ opened: boolean }> {
    if (openingBoard) throw hostError('busy', t("The board is already opening."))
    openingBoard = true
    try {
      const workspace = await focusedWorkspace(orca)
      if (!workspace?.isLocal || (expectedId !== undefined && expectedId !== workspace.id)) throw hostError('workspace_changed', t("Open the board in the focused local workspace."))
      const root = await realpath(workspace.path)
      const binary = resolveBinary('git', workspace.path, [...pathDirs(), ...EXTRA_DIRS])
      if (!binary) throw hostError('unavailable', t("Git is required to verify the local board marker is ignored."))
      const dir = join(root, '.orca')
      const dirInfo = await lstat(dir).catch(error => { if (error.code === 'ENOENT') return null; throw error })
      if (dirInfo && (!dirInfo.isDirectory() || dirInfo.isSymbolicLink())) throw hostError('invalid_params', t("The board directory must be a local directory, not a symbolic link."))
      try { await run(binary, ['check-ignore', '--quiet', '--', BOARD_PATH], { cwd: root }) }
      catch { throw hostError('invalid_params', t("Ignore .orca/ in Git before opening the board; no project file was written.")) }
      const current = await focusedWorkspace(orca)
      if (current?.id !== workspace.id || current.path !== workspace.path || await realpath(workspace.path) !== root) throw hostError('workspace_changed', t("The workspace changed."))
      await mkdir(dir, { recursive: true })
      if (await realpath(dir) !== dir) throw hostError('invalid_params', t("The board directory changed."))
      const path = join(root, BOARD_PATH)
      const info = await lstat(path).catch(error => { if (error.code === 'ENOENT') return null; throw error })
      if (info && (!info.isFile() || info.isSymbolicLink() || info.size > 4096)) throw hostError('invalid_params', t("The board marker is not a valid local file."))
      if (!info) await writeFile(path, boardMarker(workspace.id), { flag: 'wx' })
      const marker = await readFile(path, 'utf8')
      if (markerWorkspace(marker) !== workspace.id) throw hostError('invalid_params', t("The board marker belongs to another workspace or version; it was preserved."))
      const after = await focusedWorkspace(orca)
      if (after?.id !== workspace.id || after.path !== workspace.path || await realpath(path) !== path || await realpath(workspace.path) !== root) throw hostError('workspace_changed', t("The workspace changed."))
      await orca.host.call('editor.open', { workspaceId: workspace.id, path: BOARD_PATH })
      return { opened: true }
    } finally { openingBoard = false }
  }
  orca.commands.register('openspec-pulse.openBoard', () => openBoard())
  handle('board.open', ({ workspaceId }) => openBoard(workspaceId))

  handle('artifacts.read', ({ workspaceId, name, file, archived }) => readWorkspace(workspaceId, async workspace => {
    const detail = archived ? await readArchivedDetail(workspace.path, name) : await readChangeDetail(workspace.path, name)
    if (detail && workspace.specRoot && !inStoreScope(detail.name, workspace.specRoot.prefixes)) return null
    if (!detail || !openableFiles(detail).includes(file)) return null
    const root = await realpath(workspace.path)
    const path = join(root, archived ? ARCHIVE_DIR : CHANGES_DIR, name, file)
    if (await realpath(path).catch(() => null) !== path) return null
    const handle = await open(path, 'r')
    try {
      if (!(await handle.stat()).isFile()) return null
      // Keep the response below the bridge limit, even if a file grows during the read.
      const buffer = Buffer.alloc(48_001)
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
      if (bytesRead > 48_000) throw hostError('invalid_params', t("Artifact exceeds the 48 KB preview limit. Use Open in editor."))
      if (await realpath(path).catch(() => null) !== path) return null
      return { file, markdown: buffer.subarray(0, bytesRead).toString('utf8') }
    } finally { await handle.close() }
  }))
  /** The last summary sent to the status bar, as JSON, so repeats are skipped. */
  let lastStatus: string | null = null
  let focusedReadGeneration = 0

  const relations = new RelationCache()
  let relationGeneration = 0
  function invalidateRelations(): void {
    relations.invalidate()
    relationGeneration++
  }

  async function resolveReadWorkspace(workspaceId?: string, knownFocus?: Workspace): Promise<{ focus: Workspace; workspace: Workspace; identity: GitIdentity | null }> {
    const focus = knownFocus ?? await focusedWorkspace(orca)
    if (!focus?.isLocal) throw hostError('workspace_changed', t("The workspace changed or no local workspace is focused."))
    if (workspaceId === undefined || workspaceId === focus.id) return { focus, workspace: focus, identity: null }
    const { workspaces } = await orca.host.call('workspace.list', {})
    const row = workspaces.find(row => row.id === workspaceId)
    if (!row || !isLocalWorkspace(row)) throw hostError('workspace_changed', t("The workspace changed or is unavailable."))
    const binary = resolveBinary('git', focus.path, [...pathDirs(), ...EXTRA_DIRS])
    if (!binary) throw hostError('unavailable', t("Git is unavailable."))
    const [focusedIdentity, identity] = await Promise.all([gitIdentity(focus.path, binary), gitIdentity(row.path, binary)])
      .catch(() => { throw hostError('workspace_changed', t("The workspace changed or its Git identity cannot be verified.")) })
    if (!sameRepository(focusedIdentity, identity)) throw hostError('workspace_changed', t("The workspace changed or no longer belongs to this repository."))
    return { focus, workspace: { id: row.id, name: row.name, path: row.path, isLocal: true }, identity }
  }

  async function readWorkspace<T>(workspaceId: string | undefined, read: (workspace: Workspace) => Promise<T>, knownFocus?: Workspace, retryInvalidation = true): Promise<T> {
    const before = await resolveReadWorkspace(workspaceId, knownFocus)
    const roots = async (path: string) => Promise.all(['openspec', CHANGES_DIR, ARCHIVE_DIR, SPECS_DIR].map(dir => realpath(join(path, dir)).catch(() => null)))
    const specRoot = await dataRoot(before.workspace)
    const root = await roots(specRoot.dataPath)
    const generation = relationGeneration
    const result = await read({ ...before.workspace, executionPath: before.workspace.path, path: specRoot.kind === 'store' ? specRoot.dataPath : before.workspace.path, specRoot })
    const after = await resolveReadWorkspace(workspaceId)
    const afterSpecRoot = await dataRoot(after.workspace)
    const currentRoot = await roots(afterSpecRoot.dataPath)
    if (before.focus.id !== after.focus.id || before.focus.path !== after.focus.path ||
        before.workspace.id !== after.workspace.id || before.workspace.path !== after.workspace.path ||
        before.identity?.root !== after.identity?.root || before.identity?.commonDir !== after.identity?.commonDir ||
        specRoot.fingerprint !== afterSpecRoot.fingerprint || JSON.stringify(root) !== JSON.stringify(currentRoot)) {
      throw hostError('workspace_changed', t("The workspace changed or spec relations changed. Refresh to load them again."))
    }
    if (generation !== relationGeneration) {
      if (retryInvalidation) return readWorkspace(workspaceId, read, after.focus, false)
      throw hostError('workspace_changed', t("The workspace changed or spec relations changed. Refresh to load them again."))
    }
    return result
  }

  async function relationSnapshot<T>(workspaceId: string | undefined, read: (workspace: Workspace, index: Map<string, ChangeRef[]>) => Promise<T>): Promise<T | null> {
    const focus = await focusedWorkspace(orca)
    if (!focus?.isLocal) return null
    return readWorkspace(workspaceId, async workspace => {
      const root = await realpath(join(workspace.path, 'openspec')).catch(() => null)
      if (!root) return null
      const load = async () => buildRelations((await readRelationEntries(workspace.path)).filter(entry => !workspace.specRoot || inStoreScope(entry.change.name, workspace.specRoot.prefixes)))
      const index = workspace.id === focus.id ? await relations.get(`${workspace.id}:${root}:${workspace.specRoot?.fingerprint}`, load) : await load()
      return read(workspace, index)
    }, focus, true)
  }

  async function browseWorktrees({ focusedWorkspaceId, scope }: { focusedWorkspaceId: string; scope: import('./protocol').BrowseScope }, retry = true): Promise<BrowseSnapshot> {
    // Reading from a second surface must not invalidate the first surface's in-flight read.
    relations.invalidate()
    const generation = relationGeneration
    const focus = await focusedWorkspace(orca)
    if (!focus?.isLocal || focus.id !== focusedWorkspaceId) throw hostError('workspace_changed', t("The focused workspace changed."))
    const { workspaces, truncated } = await orca.host.call('workspace.list', {})
    const diagnostics: string[] = truncated ? [t("Orca returned an incomplete workspace list.")] : []
    const binary = resolveBinary('git', focus.path, [...pathDirs(), ...EXTRA_DIRS])
    let identity: GitIdentity | null = null
    try { if (binary) identity = await gitIdentity(focus.path, binary) }
    catch { diagnostics.push(t("Cannot verify Git identity of the focused workspace; siblings are excluded.")) }
    const worktrees: WorktreeOrigin[] = [{ workspaceId: focus.id, name: focus.name, branch: identity?.branch ?? null }]
    for (const row of workspaces) {
      if (row.id === focus.id || !isLocalWorkspace(row) || !identity || !binary) continue
      try {
        const candidate = await gitIdentity(row.path, binary)
        if (sameRepository(identity, candidate)) worktrees.push({ workspaceId: row.id, name: row.name, branch: candidate.branch })
      } catch { diagnostics.push(t("Cannot verify worktree {p0}; excluded.", { p0: row.name })) }
    }
    if (!binary) diagnostics.push(t("Git is unavailable; siblings are excluded."))
    const selected = scope === 'focused' ? worktrees.slice(0, 1) : scope === 'all' ? worktrees : worktrees.filter(w => w.workspaceId === scope)
    if (!selected.length) throw hostError('workspace_changed', t("The selected worktree is no longer available. Select This worktree."))
    const changes: import('./protocol').Change[] = [], archive: import('./protocol').ArchivedChange[] = [], specs: import('./protocol').SpecSummary[] = []
    const spendSources: Awaited<ReturnType<typeof readSpendSources>>[] = []
    const spendStamps: { workspaceId: string; root: string; config: string | null }[] = []
    let hasOpenSpec = false
    let workflow: import('./config').WorkflowInfo | undefined
    let effectiveRoot: OpenSpecRoot | undefined
    for (const origin of selected) {
      const spend = await readWorkspace(origin.workspaceId, async workspace => {
        const [active, archived, shared] = await Promise.all([readChanges(workspace.path), readArchive(workspace.path), readSpecList(workspace.path)])
        const config = await readWorkflow(workspace.path)
        if (selected.length === 1) workflow = config
        const source = await readSpendSources(workspace.specRoot!, config.config?.runs)
        if ((await readWorkflow(workspace.path)).fingerprint !== config.fingerprint) throw hostError("workspace_changed", t("Run configuration changed during read. Refresh."))
        if (config.error) diagnostics.push(`${origin.name}: ${config.error}`)
        hasOpenSpec ||= active !== null
        const data = workspace.specRoot!
        if (selected.length === 1 && (data.kind === 'store' || data.diagnostics.length)) effectiveRoot = data
        diagnostics.push(...data.diagnostics)
        if (data.kind === 'store') diagnostics.push(t("{p0}: store {p1} · {p2} · scope {p3} · read only", { p0: origin.name, p1: data.storeId ?? '', p2: data.dataPath, p3: data.prefixes.join(', ') || t("all systems") }))
        changes.push(...scopeEntries(active ?? [], data).map(change => ({ ...change, origin })))
        archive.push(...scopeEntries(archived, data).map(change => ({ ...change, origin })))
        specs.push(...shared.filter(spec => inStoreScope(spec.capability, data.prefixes)).map(spec => ({ ...spec, origin })))
        return { source, stamp: { workspaceId: workspace.id, root: workspace.specRoot!.fingerprint, config: config.fingerprint } }
      })
      spendSources.push(spend.source)
      spendStamps.push(spend.stamp)
    }
    for (const stamp of spendStamps) await readWorkspace(stamp.workspaceId, async workspace => {
      if (workspace.specRoot!.fingerprint !== stamp.root || (await readWorkflow(workspace.path)).fingerprint !== stamp.config) throw hostError('workspace_changed', t("Run root, scope or configuration changed. Refresh."))
    })
    const current = await focusedWorkspace(orca)
    if (current?.id !== focus.id || current.path !== focus.path) throw hostError('workspace_changed', t("The focused workspace changed."))
    if (generation !== relationGeneration) {
      if (retry) return browseWorktrees({ focusedWorkspaceId, scope }, false)
      throw hostError('workspace_changed', t("OpenSpec data changed during the read. Refresh to load it again."))
    }
    if (identity && binary) {
      const latest = await gitIdentity(focus.path, binary)
      if (latest.root !== identity.root || !sameRepository(identity, latest)) throw hostError('workspace_changed', t("The focused repository changed."))
    }
    const workspace = scope === 'all' ? t("{p0} · All worktrees", { p0: focus.name }) : selected[0].name
    return { spend: combineSpend(spendSources), focusedWorkspaceId: focus.id, worktrees, diagnostics, archive, specs,
      list: hasOpenSpec ? { status: 'ok', workspace, ...(effectiveRoot ? { root: effectiveRoot } : {}), ...(workflow ? { workflow } : {}), changes, archived: archive.length, specs: specs.length } : { status: 'no-openspec', workspace } }
  }
  handle('worktrees.browse', input => browseWorktrees(input))

  handle('usage.get', async ({ workspaceId, workspaceIds }) => {
    await focusedLocal(workspaceId)
    if (!Array.isArray(workspaceIds) || !workspaceIds.length || workspaceIds.length > 32 || workspaceIds.some(id => typeof id !== 'string')) throw hostError('invalid_params', t("Choose 1–32 verified workspaces."))
    const reads: UsageRead[] = [], paths = new Set<string>()
    const stamps: { id: string; path: string; root: string }[] = []
    for (const id of new Set(workspaceIds)) {
      const read = await readWorkspace(id, async workspace => {
        const path = await realpath(workspace.executionPath ?? workspace.path)
        return { path, root: workspace.specRoot!.fingerprint, value: paths.has(path) ? null : await usage.read(path) }
      })
      if (read.value) { paths.add(read.path); reads.push(read.value) }
      stamps.push({ id, path: read.path, root: read.root })
    }
    for (const stamp of stamps) await readWorkspace(stamp.id, async workspace => {
      if (await realpath(workspace.executionPath ?? workspace.path) !== stamp.path || workspace.specRoot!.fingerprint !== stamp.root) throw hostError('workspace_changed', t("Usage workspace or root changed. Refresh."))
    })
    await focusedLocal(workspaceId)
    return summarizeUsage(reads, JSON.stringify([...paths].sort()))
  })


  function watchChanges(dir: string | null): void {
    if (activation !== activationGeneration) return
    if (dir === watchedDir) return
    relations.invalidate()
    watcher?.close()
    watcher = null
    watchedDir = dir
    if (!dir) return
    try {
      watcher = watch(dir, { recursive: true }, () => {
        if (dir !== watchedDir) return
        invalidateRelations()
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
    const generation = ++focusedReadGeneration
    const setWatch = (path: string | null) => { if (generation === focusedReadGeneration) watchChanges(path) }
    const workspace = await focusedWorkspace(orca)
    if (!workspace) {
      configWatcher?.close(); configWatcher = null; watchedConfig = null
      setWatch(null)
      return { status: 'no-workspace' }
    }
    if (!workspace.isLocal) {
      configWatcher?.close(); configWatcher = null; watchedConfig = null
      setWatch(null)
      return { status: 'remote', workspace: workspace.name }
    }
    try {
      return await readWorkspace(workspace.id, async current => {
        const root = current.specRoot!
        const changes = await readChanges(current.path)
        const configDir = join(workspace.path, 'openspec')
        const nextConfig = root.kind === 'store' ? configDir : null
        if (generation === focusedReadGeneration && watchedConfig !== nextConfig) {
          configWatcher?.close(); configWatcher = null; watchedConfig = nextConfig
          if (nextConfig) {
            try { configWatcher = watch(nextConfig, { recursive: true }, () => {
              if (nextConfig !== watchedConfig || activation !== activationGeneration) return
              invalidateRelations()
              clearTimeout(debounce)
              debounce = setTimeout(() => { orca.panels.post('changes.changed', {}); void refreshStatus() }, WATCH_DEBOUNCE_MS)
            }); configWatcher.on('error', () => { configWatcher?.close(); configWatcher = null; watchedConfig = null }) }
            catch { watchedConfig = null }
          }
        }
        setWatch(changes ? join(current.path, 'openspec') : null)
        if (!changes) return { status: 'no-openspec', workspace: workspace.name } as ChangesState
        const [archive, shared] = await Promise.all([readArchive(current.path), readSpecList(current.path)])
        const workflow = await readWorkflow(current.path)
        return { status: 'ok', workspace: workspace.name, changes: scopeEntries(changes, root),
          archived: scopeEntries(archive, root).length, specs: shared.filter(spec => inStoreScope(spec.capability, root.prefixes)).length,
          ...(root.kind === 'store' || root.diagnostics.length ? { root } : {}), ...(workflow.config || workflow.error ? { workflow } : {}) } as ChangesState
      }, workspace, true)
    } catch (error) {
      setWatch(null)
      throw error
    }
  }

  // Canonical project identity shares account preferences across sibling worktrees.
  async function deliveryContext(workspace: Workspace) {
    const root = await realpath(workspace.path)
    const specRoot = await realpath(join(root, 'openspec'))
    const workflow = await readWorkflow(root)
    const git = resolveBinary('git', root, [...pathDirs(), ...EXTRA_DIRS])
    const identity = git ? await gitIdentity(root, git).catch(() => null) : null
    const project = identity?.commonDir ?? root
    let pulse = false
    if (git && identity) {
      const remote = await run(git, ['-C', root, 'config', '--get', 'remote.origin.url'], { timeout: 3000, maxBuffer: 64 * 1024,
        env: { ...process.env, GIT_DIR: undefined, GIT_WORK_TREE: undefined, GIT_COMMON_DIR: undefined } }).catch(() => null)
      pulse = /github\.com[:/]dos2locos\/openspec-pulse(?:\.git)?\/?$/i.test(remote?.stdout.trim() ?? '')
    }
    const required = pulse ? 'temperatio' : requiredLogin(workflow.config)
    return { root, specRoot, workflow, project, required }
  }
  const deliveryPrefsKey = (project: string) => `delivery:v1:${project}`
  async function deliveryLogin(project: string): Promise<string | null> {
    const stored = await orca.storage.get(deliveryPrefsKey(project)) as { v?: unknown; login?: unknown } | null
    return stored?.v === 1 && typeof stored.login === 'string' && LOGIN.test(stored.login) ? stored.login : null
  }
  // Reusing readWorkspace makes these read-only requests obey sibling and focus checks too.
  handle('delivery.get', async ({ workspaceId, names }): Promise<DeliverySnapshot> => {
    if (typeof workspaceId !== 'string' || !Array.isArray(names) || names.length > 6 || names.some(name => !isSafeChangeName(name))) throw hostError('invalid_params', t("Delivery requests need up to six existing changes."))
    return readWorkspace(workspaceId, async workspace => {
      const context = await deliveryContext(workspace)
      const login = await deliveryLogin(context.project)
      const initialFocus = await focusedWorkspace(orca)
      const validate = async () => {
        const current = await resolveReadWorkspace(workspaceId)
        const latestWorkspace = await dataWorkspace(current.workspace)
        if (latestWorkspace.specRoot?.fingerprint !== workspace.specRoot?.fingerprint) throw hostError('workspace_changed', t("The OpenSpec root or scope changed."))
        const latest = await deliveryContext(latestWorkspace).catch(() => { throw hostError('workspace_changed', t("The project root changed. Refresh to query again.")) })
        if (current.focus.id !== initialFocus?.id || current.focus.path !== initialFocus?.path ||
            JSON.stringify([latest.root, latest.specRoot, latest.project, latest.required, latest.workflow.fingerprint]) !== JSON.stringify([context.root, context.specRoot, context.project, context.required, context.workflow.fingerprint]) ||
            await deliveryLogin(context.project) !== login) throw hostError('workspace_changed', t("Project, configuration or GitHub login changed. Refresh to query again."))
      }
      const binary = resolveBinary('gh', workspace.path, [...pathDirs(), ...EXTRA_DIRS])
      const changes: DeliverySnapshot['changes'] = {}
      await Promise.all([...new Set(names)].map(async name => {
        if (!inStoreScope(name, workspace.specRoot?.prefixes ?? []) || !await readChangeDetail(workspace.path, name)) throw hostError('workspace_changed', t("The change disappeared. Refresh to query again."))
        changes[name] = await delivery.get({ key: JSON.stringify([context.root, context.specRoot, context.workflow.fingerprint]), cwd: context.root, binary, login,
          requiredLogin: context.required, github: context.workflow.config?.github, ticket: ticketFor(name, context.workflow.config?.tickets), validate })
      }))
      await validate()
      return { workspaceId, project: context.project, login, requiredLogin: context.required, configured: !!context.workflow.config?.github, changes }
    })
  })

  let savingDelivery = false
  handle('delivery.login.set', async ({ workspaceId, project, login }) => {
    if (savingDelivery) throw hostError('busy', t("A GitHub preference is being saved."))
    if (login !== null && (typeof login !== 'string' || !LOGIN.test(login))) throw hostError('invalid_params', t("Enter a valid GitHub login."))
    savingDelivery = true
    try {
      const workspace = await focusedWorkspace(orca)
      if (!workspace?.isLocal || workspace.id !== workspaceId) throw hostError('workspace_changed', t("The focused workspace changed."))
      return await readWorkspace(workspaceId, async current => {
        const context = await deliveryContext(current)
        if (context.project !== project) throw hostError('workspace_changed', t("The project changed."))
        if (context.required && login !== null && login.toLowerCase() !== context.required) throw hostError('invalid_params', t("This project requires {p0}.", { p0: context.required }))
        const key = deliveryPrefsKey(project)
        const previous = await orca.storage.get(key)
        const kept = previous && typeof previous === 'object' && !Array.isArray(previous) ? previous : {}
        const after = await focusedWorkspace(orca)
        const latestWorkspace = after?.isLocal ? await dataWorkspace(after) : null
        const latest = latestWorkspace ? await deliveryContext(latestWorkspace) : null
        if (after?.id !== workspaceId || after.path !== (current.executionPath ?? current.path) || latestWorkspace?.specRoot?.fingerprint !== current.specRoot?.fingerprint || !latest || latest.project !== project || latest.specRoot !== context.specRoot || latest.workflow.fingerprint !== context.workflow.fingerprint) throw hostError('workspace_changed', t("The project changed."))
        await orca.storage.set(key, { ...kept, v: 1, login })
        orca.panels.post('changes.changed', {})
        return { login }
      })
    } finally { savingDelivery = false }
  })

  handle('changes.list', () => { relations.invalidate(); return listChanges() })
  // With the panel closed too: the status bar follows the focused workspace.
  orca.events.on('workspace.changed', () => { invalidateRelations(); watchChanges(null); configWatcher?.close(); configWatcher = null; watchedConfig = null; return refreshStatus() })
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
    if (!cli) throw new Error(t("Orca CLI not found."))
    const { stdout } = await run(cli, ['plugin', 'list', '--json'], { timeout: OPEN_PANEL_TIMEOUT_MS })
    const key = pickPluginKey(stdout)
    if (!key) throw new Error(t("openspec-pulse is not running or idle in `orca plugin list`."))
    await run(cli, openPanelArgs(key), { timeout: OPEN_PANEL_TIMEOUT_MS })
  }

  handle('changes.detail', ({ name, workspaceId }) => relationSnapshot(workspaceId, async (workspace, index) => {
    const detail = await readChangeDetail(workspace.path, name)
    return detail && inStoreScope(detail.name, workspace.specRoot?.prefixes ?? []) ? { ...detail, ...(workspace.specRoot?.kind === 'store' ? { readOnly: true } : {}), workspaceId: workspace.id,
      related: relatedChanges(index, detail.specs.map(path => path.slice(6, -8)), { source: 'active', name }) } : null
  }))

  handle('archive.list', async () => {
    const workspace = await focusedWorkspace(orca)
    return workspace?.isLocal ? readWorkspace(workspace.id, async current => scopeEntries(await readArchive(current.path), current.specRoot!)) : []
  })

  handle('archive.detail', ({ folder, workspaceId }) => relationSnapshot(workspaceId, async (workspace, index) => {
    const detail = await readArchivedDetail(workspace.path, folder)
    return detail && inStoreScope(detail.name, workspace.specRoot?.prefixes ?? []) ? { ...detail, ...(workspace.specRoot?.kind === 'store' ? { readOnly: true } : {}),
      related: relatedChanges(index, detail.specs.map(path => path.slice(6, -8)), { source: 'archive', name: detail.name, folder }) } : null
  }))

  handle('specs.detail', ({ capability, workspaceId }) => relationSnapshot(workspaceId, async (workspace, index) => {
    if (!inStoreScope(capability, workspace.specRoot?.prefixes ?? []) || !(await specCapabilities(workspace.path)).includes(capability)) return null
    return { ...(workspace.specRoot?.kind === 'store' ? { readOnly: true } : {}), capability, ...parseSpec(await readFile(join(workspace.path, SPECS_DIR, capability, 'spec.md'), 'utf8')),
      changes: index.get(capability) ?? [] }
  }))

  handle('specs.list', async () => {
    const workspace = await focusedWorkspace(orca)
    return workspace?.isLocal ? readWorkspace(workspace.id, async current => (await readSpecList(current.path)).filter(spec => inStoreScope(spec.capability, current.specRoot!.prefixes))) : []
  })

  async function editorTarget(workspace: Workspace, path: string): Promise<{ workspaceId: string; path: string } | null> {
    if (workspace.specRoot?.kind === 'store') throw hostError('unavailable', t("Shared store files are read only. Use the artifact preview or open the registered store separately."))
    const root = await realpath(workspace.path)
    const file = await realpath(join(workspace.path, path)).catch(() => null)
    return file === join(root, path) && file.startsWith(root + sep) ? { workspaceId: workspace.id, path } : null
  }

  handle('specs.open', async ({ capability, workspaceId }) => {
    try {
      const target = await readWorkspace(workspaceId, async workspace => {
        if (!inStoreScope(capability, workspace.specRoot?.prefixes ?? []) || !(await specCapabilities(workspace.path)).includes(capability)) return null
        return editorTarget(workspace, join(SPECS_DIR, capability, 'spec.md'))
      })
      if (!target) return { opened: false }
      await orca.host.call('editor.open', target)
      return { opened: true }
    } catch (error) {
      if ((error as { code?: string }).code === 'workspace_changed' || (error as { code?: string }).code === 'unavailable') return { opened: false }
      throw error
    }
  })

  handle('openspec.init', async (input) => {
    const workspace = await focusedWorkspace(orca)
    if (!workspace?.isLocal) return listChanges()
    if (input?.workspaceId !== undefined && input.workspaceId !== workspace.id) throw hostError('workspace_changed', t("Initialization is limited to the focused workspace."))
    if ((await dataRoot(workspace)).kind === 'store') throw hostError('unavailable', t("This workspace uses a shared store. Unlink it before local initialization."))
    const binary = resolveOpenspec(workspace.path)
    if (!binary) {
      throw new Error(
        t("openspec CLI not found in ~/.local/bin, /opt/homebrew/bin, /usr/local/bin or PATH. ") +
          t("Install it with: npm install -g @fission-ai/openspec")
      )
    }
    try {
      await run(binary, INIT_ARGS, { cwd: workspace.path, timeout: INIT_TIMEOUT_MS })
    } catch (error) {
      const err = error as Error & { stderr?: string }
      const reason = err.stderr?.trim() || err.message
      orca.log(`openspec init in ${workspace.path} failed: ${reason}`)
      throw new Error(t("openspec init failed: {p0}", { p0: reason }))
    }
    return listChanges()
  })

  // Per workspace, versioned. Unknown fields of a newer version are kept when this one writes.
  const prefsKey = (workspaceId: string): string => `agent:${workspaceId}`

  async function loadPrefs(workspaceId: string): Promise<AgentPrefs> {
    try {
      return readPrefs(await orca.storage.get(prefsKey(workspaceId)))
    } catch (error) {
      orca.log(`cannot read agent preferences: ${(error as Error).message}`)
      return readPrefs(null)
    }
  }

  handle('agent.options', async (): Promise<AgentOptions | null> => {
    const workspace = await focusedWorkspace(orca)
    if (!workspace?.isLocal) return null
    const [prefs, { agents }] = await Promise.all([loadPrefs(workspace.id), orca.host.call('agents.list', {})])
    return readWorkspace(workspace.id, async current => {
      const workflow = await readWorkflow(current.path)
      const approvedCommands = await loadApprovals(current.id, workflow.fingerprint)
      return { workspaceId: current.id, profiles: listProfiles(), prefs, sessions: listSessions(agents), workflow, approvedCommands }
    })
  })

  handle('agent.prefs.set', async ({ workspaceId, prefs }) => {
    const workspace = await focusedWorkspace(orca)
    if (!workspace?.isLocal || workspace.id !== workspaceId) throw hostError('workspace_changed', t("The focused workspace changed."))
    if (!isProfileId(prefs?.profile)) throw hostError('invalid_params', t("Unknown profile {p0}.", { p0: String(prefs?.profile) }))
    const checked = checkModel(prefs.profile, prefs.model)
    if ('error' in checked) throw hostError('invalid_params', checked.error)
    const previous = await orca.storage.get(prefsKey(workspaceId)).catch(() => null)
    const kept = previous && typeof previous === 'object' && !Array.isArray(previous) ? previous : {}
    const saved: AgentPrefs = { profile: prefs.profile, model: checked.model }
    await orca.storage.set(prefsKey(workspaceId), { ...kept, v: 1, ...saved })
    return saved
  })

  // Local, versioned consent: exact command + workspace + root-bound configuration digest.
  const approvalKey = (id: string): string => `workflow-approval:${id}`
  async function loadApprovals(id: string, fingerprint: string | null): Promise<string[]> {
    const stored = await orca.storage.get(approvalKey(id)) as { v?: unknown; fingerprint?: unknown; commands?: unknown } | null
    return stored?.v === 1 && fingerprint !== null && stored.fingerprint === fingerprint && Array.isArray(stored.commands)
      ? stored.commands.filter((c): c is string => typeof c === 'string') : []
  }

  // One send at a time: a double click or a second panel cannot type the prompt twice.
  let sending = false

  handle('agent.run', async (input) => {
    const { action, change, prompt } = input
    if (!isAgentAction(action)) throw hostError('invalid_params', t("unknown action {p0}", { p0: String(action) }))
    if (action === 'task' && (!input.workspaceId || !input.task || !isSafeChangeName(change))) {
      throw hostError('invalid_params', t("A task needs its workspace, change and selection."))
    }
    if (action !== 'task' && input.task) throw hostError('invalid_params', t("A task selection needs the task action."))
    const target: AgentTarget = input.target ?? 'auto'
    if (!isTarget(target)) throw hostError('invalid_params', t("unknown destination"))
    if (sending) throw hostError('busy', t("Another command is being sent."))
    sending = true
    try {
      const workspace = await focusedWorkspace(orca)
      if (!workspace) throw hostError('unavailable', t("No workspace is focused."))
      // What the person saw in the panel must still be what is focused.
      if (input.workspaceId !== undefined && input.workspaceId !== workspace.id) {
        throw hostError('workspace_changed', t("The focused workspace changed; nothing was sent."))
      }
      if (!workspace.isLocal && action === 'task') throw hostError('task_conflict', t("The task is unavailable. Refresh and select it again; nothing was sent."))
      const initialData = workspace.isLocal ? await dataRoot(workspace) : null
      if (initialData?.kind === 'store') throw hostError('unavailable', t("Shared store agents need an explicit execution association; nothing was sent."))
      const initialRoot = workspace.isLocal ? await realpath(workspace.path) : null
      const initialWorkflow = workspace.isLocal ? await readWorkflow(workspace.path) : { config: null, fingerprint: null, error: null }
      const saved = await loadPrefs(workspace.id)
      const profile: ProfileId = input.profile ?? saved.profile
      if (!isProfileId(profile)) throw hostError('invalid_params', t("Unknown profile {p0}.", { p0: String(profile) }))
      const model = checkModel(profile, input.model === undefined ? saved.model : input.model)
      if ('error' in model) throw hostError('invalid_params', model.error)
      // The change name goes into the agent's prompt: only accept one that exists on disk.
      if (isChangeAction(action) && action !== 'task') {
        const known = workspace.isLocal && isSafeChangeName(change) && (await readChangeDetail(workspace.path, change))
        if (!known) throw hostError('invalid_params', t("No active change named {p0}.", { p0: String(change) }))
      }
      // Discover the destination first; resolve the task immediately before delivery.
      const terminalId = await pickTerminal(profile, target)
      const preparePrompt = async (): Promise<string> => {
        const current = await focusedWorkspace(orca)
        if (current?.id !== workspace.id || current.path !== workspace.path || current.isLocal !== workspace.isLocal) {
          throw hostError('workspace_changed', t("The focused workspace changed; nothing was sent."))
        }
        if (workspace.isLocal && (await dataRoot(workspace)).fingerprint !== initialData?.fingerprint) throw hostError('workspace_changed', t("The OpenSpec root changed; nothing was sent."))
        let task
        if (action === 'task') {
          try {
            if (workspace.isLocal) {
              const root = await realpath(workspace.path)
              const file = join(root, CHANGES_DIR, change!, 'tasks.md')
              if (await realpath(file) === file) task = resolveTask(await readChangeDetail(workspace.path, change!), input.task)
            }
          } catch (error) {
            if (!['ENOENT', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error
          }
          if (!task) {
            orca.panels.post('changes.changed', {})
            throw hostError('task_conflict', t("The task changed, completed or disappeared. Refresh and select it again; nothing was sent."))
          }
        }
        const workflow = workspace.isLocal ? await readWorkflow(workspace.path) : initialWorkflow
        if (workflow.fingerprint !== initialWorkflow.fingerprint ||
            (input.workflowFingerprint !== undefined && input.workflowFingerprint !== workflow.fingerprint)) {
          throw hostError('config_changed', t("Project configuration changed. Reopen the command preview; nothing was sent."))
        }
        const built = buildPrompt(profile, action, { change, prompt: action === 'task' ? undefined : prompt, task: task ?? undefined }, workflow.config)
        if ('error' in built) throw hostError('invalid_params', built.error)
        if (workflow.config?.commands?.[action]) {
          if (input.workspaceId !== workspace.id || input.workflowFingerprint !== workflow.fingerprint) {
            throw hostError('config_changed', t("Refresh the project command preview before sending."))
          }
          const approved = await loadApprovals(workspace.id, workflow.fingerprint)
          if (!approved.includes(built.prompt)) {
            if (input.approval?.fingerprint !== workflow.fingerprint || input.approval?.command !== built.prompt) {
              throw hostError('approval_required', t("Accept the effective project command in the preview before sending."))
            }
            const previous = await orca.storage.get(approvalKey(workspace.id))
            const kept = previous && typeof previous === 'object' && !Array.isArray(previous) ? previous : {}
            await orca.storage.set(approvalKey(workspace.id), { ...kept, v: 1, fingerprint: workflow.fingerprint, commands: [...approved.slice(-99), built.prompt] })
          }
        }
        if (terminalId) {
          const { agents } = await orca.host.call('agents.list', {})
          const problem = sessionProblem(profile, agents, terminalId)
          if (problem) throw hostError('session_unavailable', problem)
        }
        if (action === 'task' && !resolveTask(await readChangeDetail(workspace.path, change!), input.task)) {
          throw hostError('task_conflict', t("The task changed. Refresh and select it again; nothing was sent."))
        }
        if (workspace.isLocal && (await realpath(workspace.path) !== initialRoot || (await readWorkflow(workspace.path)).fingerprint !== workflow.fingerprint)) {
          throw hostError('workspace_changed', t("The workspace or configuration changed; nothing was sent."))
        }
        if (workspace.isLocal && (await dataRoot(workspace)).fingerprint !== initialData?.fingerprint) throw hostError('workspace_changed', t("The OpenSpec root changed; nothing was sent."))
        const after = await focusedWorkspace(orca)
        if (after?.id !== workspace.id || after.path !== workspace.path || after.isLocal !== workspace.isLocal) {
          throw hostError('workspace_changed', t("The focused workspace changed; nothing was sent."))
        }
        return built.prompt
      }
      const agent = profileInfo(profile).agent
      if (terminalId) {
        await sendToTerminal(workspace, terminalId, preparePrompt)
        return { surface: 'open-terminal' as const, agent }
      }
      return { ...(await launchChat(workspace.path, profile, await preparePrompt(), model.model)), agent }
    } finally {
      sending = false
    }
  })

  /**
   * The terminal to type into, or null to open a new session (`auto` with none idle). A session the
   * person chose that is busy, asking, gone or another agent is an error, never a different target.
   */
  async function pickTerminal(profile: ProfileId, target: AgentTarget): Promise<string | null> {
    if (target === 'new') return null
    const { agents } = await orca.host.call('agents.list', {})
    if (target === 'auto') {
      const idle = pickIdleTerminal(profile, agents)
      if (!idle) orca.log(`no idle ${profileInfo(profile).agent} terminal (${agents.map((a) => `${a.agent}:${a.state}:${a.terminalId ?? 'no-terminal'}`).join(', ')}); opening a chat`)
      return idle
    }
    const problem = sessionProblem(profile, agents, target.terminalId)
    if (problem) throw hostError('session_unavailable', problem)
    return target.terminalId
  }

  /** Types the prompt into the terminal, after checking once more that the workspace is still focused. */
  async function sendToTerminal(workspace: Workspace, terminalId: string, preparePrompt: () => Promise<string>): Promise<void> {
    const current = await focusedWorkspace(orca)
    if (current?.id !== workspace.id) throw hostError('workspace_changed', t("The focused workspace changed; nothing was sent."))
    const prompt = await preparePrompt()
    // A newline would submit the TUI's input early: send the prompt as one line.
    const { accepted } = await orca.host.call('terminal.sendText', {
      terminalId,
      text: prompt.replace(/\s*\n\s*/g, ' '),
      enter: true
    })
    if (!accepted) {
      orca.log(`terminal ${terminalId} did not accept the prompt`)
      throw hostError('delivery_rejected', t("The session did not accept the command. Nothing was sent elsewhere."))
    }
    await orca.host.call('terminal.focus', { terminalId })
  }

  /**
   * A new agent chat, shown in the current window. The host API's agent.launch only opens a
   * background terminal, so this runs Orca's CLI; execFile with an argument list, so the prompt is
   * never parsed by a shell. A timeout or failure is reported, not retried elsewhere.
   */
  async function launchChat(workspacePath: string, profile: ProfileId, prompt: string, model: string | null): Promise<{ surface: 'chat' | 'terminal' }> {
    const cli = resolveOrcaCli(workspacePath)
    if (!cli) throw hostError('unavailable', t("Orca CLI not found."))
    const label = profileInfo(profile).label
    try {
      const { stdout } = await run(cli, agentLaunchArgs(profile, workspacePath, prompt, model), { timeout: LAUNCH_TIMEOUT_MS })
      return { surface: launchedSurface(stdout) }
    } catch (error) {
      const err = error as Error & { stdout?: string; killed?: boolean }
      const reason = err.killed ? t("Orca did not confirm the new session within {p0} s", { p0: LAUNCH_TIMEOUT_MS / 1000 }) : (cliError(err.stdout) ?? err.message)
      orca.log(`orca agent launch failed: ${reason}`)
      throw new Error(t("Could not start {p0}: {p1}", { p0: label, p1: reason }))
    }
  }

  handle('changes.open', async ({ name, file, archived, workspaceId }) => {
    try {
      const target = await readWorkspace(workspaceId, async workspace => {
        const detail = archived ? await readArchivedDetail(workspace.path, name) : await readChangeDetail(workspace.path, name)
        if (detail && workspace.specRoot && !inStoreScope(detail.name, workspace.specRoot.prefixes)) return null
        const filePath = detail && (file ?? fileToOpen(detail))
        if (!detail || !filePath || !openableFiles(detail).includes(filePath)) return null
        return editorTarget(workspace, join(archived ? ARCHIVE_DIR : CHANGES_DIR, name, filePath))
      })
      if (!target) return { opened: false }
      await orca.host.call('editor.open', target)
      return { opened: true }
    } catch (error) {
      if ((error as { code?: string }).code === 'workspace_changed' || (error as { code?: string }).code === 'unavailable') return { opened: false }
      throw error
    }
  })
}
