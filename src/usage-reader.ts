import { t, uiLocale } from './i18n'
import { constants } from 'node:fs'
import { lstat, open, opendir, realpath } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { readRunFile } from './spend-reader'
import { claudeUsage, codexUsage, type UsageRead } from './usage'

export type UsageHomes = { claude: string[]; codex: string[] }
const empty = (): UsageRead => ({ events: [], files: 0, truncated: 0, discarded: 0, warnings: [] })
const missing = (e: unknown) => (e as NodeJS.ErrnoException).code === 'ENOENT'
const key = (path: string, stat: { dev: number; ino: number; size: number; mtimeMs: number; ctimeMs: number }) => JSON.stringify([path, stat.dev, stat.ino, stat.size, stat.mtimeMs, stat.ctimeMs])
export async function usageHomes(): Promise<UsageHomes> {
  const home = homedir()
  const result = { claude: [process.env.CLAUDE_CONFIG_DIR || join(home, '.claude')], codex: [process.env.CODEX_HOME || join(home, '.codex')] }
  // Orca isolates agent accounts in separate homes. Discover directories, never auth/config files.
  const app = process.platform === 'darwin' ? join(home, 'Library/Application Support/orca') : join(process.env.XDG_CONFIG_HOME || join(home, '.config'), 'orca')
  for (const agent of ['claude', 'codex'] as const) {
    try {
      const accounts = await opendir(join(app, agent + '-accounts'))
      for await (const account of accounts) if (account.isDirectory()) {
        result[agent].push(join(app, agent + '-accounts', account.name, 'home'))
        if (agent === 'claude') result[agent].push(join(app, agent + '-accounts', account.name))
      }
    } catch (e) { if (!missing(e)) throw new Error(t("Cannot discover Orca agent homes.")) }
  }
  return result
}
type Meta = { id: string; cwd: string; model?: string }
export class AgentUsageReader {
  private cache = new Map<string, { stamp: string; read: UsageRead }>()
  private headers = new Map<string, { stamp: string; meta: Meta | null }>()
  constructor(private discover: () => Promise<UsageHomes> = usageHomes) {}
  /** Caches contain token metadata only; never source lines, messages, tools or credentials. */
  async read(workspacePath: string): Promise<UsageRead> {
    const workspace = await realpath(workspacePath), homes = await this.discover()
    const result = empty(), seen = new Set<string>()
    let visited = 0
    const append = (read: UsageRead) => {
      result.events.push(...read.events); result.files += read.files; result.truncated += read.truncated; result.discarded += read.discarded
      result.warnings.push(...read.warnings)
    }
    const canonicalHome = async (path: string) => {
      try { return await realpath(path) }
      catch (e) { if (!missing(e)) result.warnings.push(t("No se puede acceder a una instalación local del agente.")); return null }
    }
    const walk = async (root: string, path: string, depth: number, visit: (file: string) => Promise<void>) => {
      if (visited >= 10_000) { result.warnings.push(t("Descubrimiento limitado a 10.000 archivos por actualización.")); return }
      try {
        const info = await lstat(path)
        if (info.isSymbolicLink()) { result.warnings.push(t("Enlace simbólico de sesiones excluido.")); return }
        if (!info.isDirectory()) return
        const dir = await opendir(path)
        for await (const entry of dir) {
          if (visited >= 10_000) { result.warnings.push(t("Descubrimiento limitado a 10.000 archivos por actualización.")); break }
          const file = join(path, entry.name)
          if (entry.isSymbolicLink()) { result.warnings.push(t("Enlace simbólico de sesiones excluido.")); continue }
          if (entry.isDirectory() && depth > 0) await walk(root, file, depth - 1, visit)
          else if (entry.isFile() && entry.name.endsWith('.jsonl')) { visited++; await visit(file) }
        }
      } catch (e) { if (!missing(e)) result.warnings.push(t("No se puede leer un directorio de sesiones.")); }
    }
    const load = async (root: string, path: string, agent: 'claude' | 'codex') => {
      try {
        const stat = await lstat(path)
        if (!stat.isFile() || stat.isSymbolicLink()) return
        const stamp = key(path, stat)
        let meta: Meta | null = null
        if (agent === 'codex') {
          const old = this.headers.get(path)
          if (old?.stamp === stamp) meta = old.meta
          else {
            // Inspect session metadata only before deciding if this project may be read.
            const fd = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
            try {
              const current = await fd.stat()
              if (current.ino !== stat.ino || current.dev !== stat.dev) throw new Error(t("Session changed."))
              const buffer = Buffer.alloc(65536)
              const { bytesRead } = await fd.read(buffer, 0, buffer.length, 0)
              const first = buffer.subarray(0, bytesRead).toString('utf8').split('\n', 1)[0]
              const d = JSON.parse(first)
              if (d.type === 'session_meta' && typeof d.payload?.cwd === 'string' && typeof d.payload?.id === 'string')
                meta = { id: d.payload.id, cwd: d.payload.cwd, ...(typeof d.payload.model === 'string' ? { model: d.payload.model } : {}) }
            } finally { await fd.close() }
            this.headers.set(path, { stamp, meta })
          }
          if (!meta || await realpath(meta.cwd).catch(() => null) !== workspace) return
          meta = { ...meta, cwd: workspace }
        }
        const identity = JSON.stringify([stat.dev, stat.ino])
        if (seen.has(identity)) return
        seen.add(identity)
        const cacheKey = JSON.stringify([uiLocale(), workspace, path])
        const previous = this.cache.get(cacheKey)
        if (previous?.stamp === stamp) { append(previous.read); return }
        const file = await readRunFile(root, path)
        const read = agent === 'claude' ? claudeUsage(file.lines, workspace) : codexUsage(file.lines, workspace, meta!, file.truncated)
        if (agent === 'claude' && file.truncated) read.truncated++
        if (file.truncated) read.warnings.push(t("Sesión recortada a 16 MiB / 20.000 líneas: cobertura parcial. Codex omite el primer acumulado sin base."))
        const after = await lstat(path)
        // Growing files are returned as a bounded snapshot but never cached as complete.
        if (key(path, after) === stamp) this.cache.set(cacheKey, { stamp, read })
        append(read)
      } catch { result.discarded++; result.warnings.push(t("Archivo de sesión no reconocido, cambiado o inaccesible; no se ha estimado su consumo.")) }
    }
    const roots = new Set<string>()
    for (const home of homes.claude) {
      const root = await canonicalHome(home)
      if (!root || roots.has('claude:' + root)) continue
      roots.add('claude:' + root)
      const project = workspace.replace(/[^a-zA-Z0-9-]/g, '-')
      await walk(root, join(root, 'projects', project), 4, path => load(root, path, 'claude'))
    }
    for (const home of homes.codex) {
      const root = await canonicalHome(home)
      if (!root || roots.has('codex:' + root)) continue
      roots.add('codex:' + root)
      for (const folder of ['sessions', 'archived_sessions']) await walk(root, join(root, folder), 4, path => load(root, path, 'codex'))
    }
    // Bound in-memory metadata caches; retained values never contain conversations.
    if (this.cache.size > 1000) this.cache.clear()
    if (this.headers.size > 10_000) this.headers.clear()
    result.warnings = [...new Set(result.warnings)]
    return result
  }
}
