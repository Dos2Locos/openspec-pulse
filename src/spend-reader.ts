import { t } from './i18n'
import { constants } from 'node:fs'
import { lstat, open, opendir, realpath } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import { aggregateSpend, relativeRunPath, RUN_MAX_BYTES, RUN_MAX_LINES, type RunsConfig, type SpendFile } from './spend'
import { inStoreScope, type OpenSpecRoot } from './stores'

/** Reject symlinks in every component before opening; never read an escaped target. */
async function safePath(root: string, path: string): Promise<string> {
  const relative = path.slice(root.length + 1)
  if (!path.startsWith(root + sep) || !relativeRunPath(relative)) throw new Error(t("Path escapes the approved root."))
  let current = root
  for (const part of relative.split('/')) {
    current = join(current, part)
    if ((await lstat(current)).isSymbolicLink()) throw new Error(t("Symbolic links are excluded from run paths."))
  }
  if (await realpath(path) !== path) throw new Error(t("Run path changed."))
  return path
}

export async function readRunFile(root: string, path: string): Promise<SpendFile> {
  await safePath(root, path)
  const expected = await lstat(path)
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
  try {
    const info = await handle.stat()
    await safePath(root, path)
    if (info.dev !== expected.dev || info.ino !== expected.ino) throw new Error(t("Run identity changed before read."))
    if (!info.isFile()) throw new Error(t("Run log must be a regular file."))
    const chunks: Buffer[] = []
    let position = info.size, bytes = 0, newlines = 0
    while (position > 0 && bytes < RUN_MAX_BYTES && newlines <= RUN_MAX_LINES) {
      const size = Math.min(65536, position, RUN_MAX_BYTES - bytes)
      position -= size
      const buffer = Buffer.alloc(size)
      let length = 0
      while (length < size) {
        const read = await handle.read(buffer, length, size - length, position + length)
        if (!read.bytesRead) break
        length += read.bytesRead
      }
      const chunk = buffer.subarray(0, length)
      chunks.unshift(chunk); bytes += size
      for (const byte of chunk) if (byte === 10) newlines++
    }
    await safePath(root, path)
    const after = await lstat(path)
    if (after.dev !== info.dev || after.ino !== info.ino || (await realpath(root)) !== root) throw new Error(t("Run identity changed during read."))
    let lines = Buffer.concat(chunks).toString('utf8').split('\n')
    if (lines.at(-1) === '') lines.pop()
    // A byte-bounded tail may begin in the middle of UTF-8 or JSON. Drop that fragment.
    if (position > 0) lines.shift()
    const truncated = position > 0 || lines.length > RUN_MAX_LINES
    lines = lines.slice(-RUN_MAX_LINES)
    return { identity: JSON.stringify([root, info.dev, info.ino]), namespace: root, lines, truncated }
  } finally { await handle.close() }
}

export async function readSpendSources(root: OpenSpecRoot, config: RunsConfig | false | undefined) {
  const canonical = await realpath(root.dataPath)
  const identity = JSON.stringify([canonical, [...root.prefixes].sort()])
  if (!config) return { identity, enabled: false, files: [] as SpendFile[], excluded: 0, warnings: [] as string[] }
  const files: SpendFile[] = [], warnings: string[] = []
  let excluded = 0
  const loaded = new Map<string, SpendFile>()
  const read = async (path: string, unattributed = false) => {
    if (loaded.has(path)) return
    try { const file = { ...await readRunFile(canonical, path), unattributed }; loaded.set(path, file); files.push(file) }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
      excluded++; warnings.push(`${path.slice(canonical.length + 1)}: ${(error as Error).message}`)
    }
  }
  const entries = async (path: string, visit: (name: string, directory: boolean) => Promise<void>) => {
    try {
      await safePath(canonical, path)
      const dir = await opendir(path)
      for await (const item of dir) await visit(item.name, item.isDirectory())
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') { excluded++; warnings.push(`${path.slice(canonical.length + 1)}: ${(error as Error).message}`) }
    }
  }
  if (config.file) {
    const active = join(canonical, 'openspec/changes')
    await entries(active, async (name, directory) => {
      if (name === 'archive' || !directory || !inStoreScope(name, root.prefixes)) return
      await read(join(active, name, config.file!))
    })
    const archive = join(active, 'archive')
    await entries(archive, async (name, directory) => {
      if (!directory || !inStoreScope(name.replace(/^\d{4}-\d{2}-\d{2}-/, ''), root.prefixes)) return
      await read(join(archive, name, config.file!))
    })
  }
  for (const folder of config.folders ?? []) {
    await entries(resolve(canonical, folder), async (name) => {
      if (name.endsWith('.jsonl')) await read(join(canonical, folder, name), root.prefixes.length > 0)
    })
  }
  return { identity, enabled: true, files, excluded, warnings }
}


export function combineSpend(sources: Awaited<ReturnType<typeof readSpendSources>>[]) {
  const result = aggregateSpend(JSON.stringify([...new Set(sources.map(s => s.identity))].sort()), sources.flatMap(s => s.files), sources.some(s => s.enabled))
  result.diagnostics.excluded = sources.reduce((sum, s) => sum + s.excluded, 0)
  result.warnings = [...new Set(sources.flatMap(s => s.warnings))]
  return result
}

export async function readSpend(root: OpenSpecRoot, config: RunsConfig | false | undefined) {
  return combineSpend([await readSpendSources(root, config)])
}
