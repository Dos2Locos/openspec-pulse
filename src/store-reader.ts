import { t, renderMessage, type UiMessage } from './i18n'
import { createHash, randomUUID } from 'node:crypto'
import { constants } from 'node:fs'
import { lstat, open, readFile, realpath } from 'node:fs/promises'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { inStoreScope, parseStoreList, patchStore, STORE_VERSION, storeDeclaration, storeId, type OpenSpecRoot, type RegisteredStore, type StoreOperation, type StorePreview } from './stores'

export type StoreRunner = (binary: string, args: string[], cwd: string) => Promise<string>
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const missing = (error: unknown) => (error as NodeJS.ErrnoException).code === 'ENOENT'

/** Config files and their parent must be real local files. Never follow a config symlink. */
export async function storeConfig(workspacePath: string, allowLocalLink = false) {
  const root = await realpath(workspacePath)
  const dir = join(root, 'openspec')
  const info = await lstat(dir).catch(error => { if (missing(error)) return null; throw error })
  if (info && (!info.isDirectory() || info.isSymbolicLink()) && !(allowLocalLink && info.isSymbolicLink())) throw new Error(t("openspec/ must be a real local directory."))
  for (const name of ['config.yaml', 'config.yml']) {
    const path = join(dir, name)
    const file = await lstat(path).catch(error => { if (missing(error)) return null; throw error })
    if (!file) continue
    if (!file.isFile() || file.isSymbolicLink() || file.size > 65536) throw new Error(t("OpenSpec config must be a real file of at most 64 KiB."))
    const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW)
    try {
      const buffer = Buffer.alloc(65537)
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
      if (bytesRead > 65536) throw new Error(t("OpenSpec config exceeds 64 KiB."))
      return { root, dir, path, text: buffer.subarray(0, bytesRead).toString('utf8'), exists: true }
    } finally { await handle.close() }
  }
  return { root, dir, path: join(dir, 'config.yaml'), text: '', exists: false }
}

export class StoreReader {
  private plans = new Map<string, { workspaceId: string; workspacePath: string; stamp: string; operation: StoreOperation; effects: string[] }>()
  constructor(private run: StoreRunner) {}

  async catalog(workspacePath: string, binary: string | null): Promise<RegisteredStore[]> {
    if (!binary) throw new Error(t("OpenSpec CLI is unavailable. Local mode remains available."))
    const version = (await this.run(binary, ['--version'], workspacePath)).trim()
    if (version !== STORE_VERSION) throw new Error(t("Stores require the tested OpenSpec {p0} contract; installed: {p1}. Local mode remains available.", { p0: STORE_VERSION, p1: version }))
    const help = await this.run(binary, ['store', 'setup', '--help'], workspacePath)
    if (!help.includes('--no-init-git') || !help.includes('--json') || !help.includes('--path')) throw new Error(t("OpenSpec CLI does not offer the tested store setup contract."))
    return parseStoreList(await this.run(binary, ['store', 'list', '--json'], workspacePath))
  }

  async registered(workspacePath: string, binary: string, id: string, catalog: RegisteredStore[]): Promise<string> {
    const entry = catalog.find(row => row.id === storeId(id))
    if (!entry) throw new Error(t("Unknown store '{p0}'. Register it before linking.", { p0: id }))
    if (!isAbsolute(entry.root)) throw new Error(t("Invalid path for store '{p0}'.", { p0: id }))
    const path = await realpath(entry.root)
    const info = await lstat(path)
    if (!info.isDirectory()) throw new Error(t("Store '{p0}' is not a directory.", { p0: id }))
    const answer = JSON.parse(await this.run(binary, ['list', '--json', '--store', id], workspacePath))
    if (answer.root?.store_id !== id || typeof answer.root?.path !== 'string' || await realpath(answer.root.path) !== path) throw new Error(t("Store '{p0}' returned a different identity or data root.", { p0: id }))
    if (await realpath(join(path, 'openspec')) !== join(path, 'openspec')) throw new Error(t("Store '{p0}' has an invalid openspec/ path.", { p0: id }))
    return path
  }

  async resolve(workspacePath: string, binary: string | null, prefixes: string[] = []): Promise<OpenSpecRoot> {
    const config = await storeConfig(workspacePath, true)
    const diagnostics: string[] = []
    const local = await Promise.all(['changes', 'specs'].map(name => lstat(join(config.dir, name)).then(info => info.isDirectory()).catch(() => false)))
    let id: string | null = null
    try { id = storeDeclaration(config.text).id }
    catch (error) { if (!local.some(Boolean)) throw error; diagnostics.push((error as Error).message) }
    let dataPath = config.root
    let kind: OpenSpecRoot['kind'] = 'local'
    if (id && local.some(Boolean)) diagnostics.push(t("Local OpenSpec data takes precedence over store '{p0}'. Unlink it or move the local planning folders to resolve the conflict.", { p0: id }))
    else if (id) {
      const catalog = await this.catalog(config.root, binary)
      dataPath = await this.registered(config.root, binary!, id, catalog)
      kind = 'store'
    }
    const identities = await Promise.all([dataPath, join(dataPath, 'openspec')].map(async path => {
      try { const info = await lstat(path); return [await realpath(path), info.dev, info.ino] }
      catch (error) { if (missing(error)) return null; throw error }
    }))
    const effectivePrefixes = kind === 'store' ? prefixes : []
    return { workspacePath: config.root, dataPath, kind, storeId: kind === 'store' ? id : null,
      prefixes: effectivePrefixes, diagnostics, fingerprint: digest([config, kind, id, dataPath, effectivePrefixes, identities]) }
  }

  private async stamp(workspacePath: string, binary: string | null) {
    const config = await storeConfig(workspacePath)
    const catalog = await this.catalog(config.root, binary)
    // Include the live canonical roots: retargeted registrations invalidate pending consent.
    const identity = async (path: string) => {
      try { const info = await lstat(path); return [await realpath(path), info.dev, info.ino] }
      catch (error) { if (missing(error)) return null; throw error }
    }
    const roots = await Promise.all(catalog.map(async row => [row.id, await identity(row.root), await identity(join(row.root, 'openspec'))]))
    return { config, catalog, stamp: digest([config, await identity(config.root), await identity(config.dir), catalog, roots]) }
  }

  private async creationPath(path: string): Promise<string> {
    if (typeof path !== 'string' || !isAbsolute(path) || /[\u0000-\u001f]/.test(path) || resolve(path) !== path || path === '/') throw new Error(t("Use a canonical absolute path for a new store folder."))
    if (await lstat(path).then(() => true).catch(error => { if (missing(error)) return false; throw error })) throw new Error(t("Choose a new store folder that does not exist."))
    const parent = dirname(path)
    if (await realpath(parent) !== parent || !(await lstat(parent)).isDirectory()) throw new Error(t("The store parent must be an existing canonical directory."))
    return path
  }

  async preview(workspaceId: string, workspacePath: string, binary: string | null, operation: StoreOperation): Promise<StorePreview> {
    if (!operation || !['link', 'unlink', 'create'].includes(operation.action)) throw new Error(t("Unknown store operation."))
    const { config, catalog, stamp } = await this.stamp(workspacePath, binary)
    if (!config.exists && operation.action !== 'create') throw new Error(t("Initialize OpenSpec before linking a store."))
    let messages: UiMessage[]
    if (operation.action === 'link') {
      const path = await this.registered(config.root, binary!, operation.id, catalog)
      patchStore(config.text, operation.id)
      messages = [{ key: "Set store: {p0} in {p1}. Preserve other keys and comments.", params: { p0: operation.id, p1: config.path } }, { key: "Read data from {p0}; agents remain disabled for shared changes.", params: { p0: path } }, { key: "Existing local planning folders take precedence and will not be removed." }]
    } else if (operation.action === 'unlink') {
      patchStore(config.text, null)
      messages = [{ key: "Remove only the store key from {p0}. Preserve this file, other keys and comments.", params: { p0: config.path } }, { key: "Stop reading the shared store; its files and registration remain intact." }]
    } else {
      storeId(operation.id)
      if (catalog.some(row => row.id === operation.id)) throw new Error(t("This store ID is already registered."))
      const path = await this.creationPath(operation.path)
      messages = [{ key: "Create and register store {p0} at {p1}.", params: { p0: operation.id, p1: path } }, { key: "Run OpenSpec store setup with --no-init-git: no Git init, commit, remote or publication." }, { key: "The store is not linked automatically. Review it before linking." }]
    }
    const effects = messages.map(renderMessage)
    const token = randomUUID()
    if (this.plans.size >= 32) this.plans.delete(this.plans.keys().next().value!)
    this.plans.set(token, { workspaceId, workspacePath: config.root, stamp, operation: structuredClone(operation), effects })
    return { token, effects, messages }
  }

  /** A preview token is single-use, even on failure. Validate the host just before the effect. */
  async commit(workspaceId: string, workspacePath: string, binary: string | null, token: string, validate: () => Promise<void>): Promise<void> {
    const plan = this.plans.get(token)
    this.plans.delete(token)
    if (!plan || plan.workspaceId !== workspaceId || plan.workspacePath !== await realpath(workspacePath)) throw new Error(t("Store preview expired or belongs to another workspace."))
    const current = await this.stamp(workspacePath, binary)
    if (current.stamp !== plan.stamp) throw new Error(t("Store configuration or registration changed. Review a new preview."))
    const operation = plan.operation
    if (operation.action === 'create') {
      await this.creationPath(operation.path)
      await validate()
      await this.run(binary!, ['store', 'setup', operation.id, '--path', operation.path, '--no-init-git', '--json'], current.config.root)
    } else {
      if (operation.action === 'link') await this.registered(current.config.root, binary!, operation.id, current.catalog)
      const text = patchStore(current.config.text, operation.action === 'link' ? operation.id : null)
      await validate()
      const file = await open(current.config.path, constants.O_RDWR | constants.O_NOFOLLOW)
      try {
        const info = await file.stat()
        const latest = await storeConfig(workspacePath)
        const identity = await lstat(current.config.path)
        if (latest.text !== current.config.text || identity.ino !== info.ino || identity.dev !== info.dev || latest.path !== current.config.path) throw new Error(t("OpenSpec config changed. Review a new preview."))
        await validate()
        await file.writeFile(text, 'utf8')
        await file.truncate(Buffer.byteLength(text))
      } finally { await file.close() }
    }
  }
}

export function scopeEntries<T extends { name: string }>(entries: T[], root: OpenSpecRoot): T[] {
  return root.kind === 'store' ? entries.filter(entry => inStoreScope(entry.name, root.prefixes)).map(entry => ({ ...entry, readOnly: true })) : entries
}
