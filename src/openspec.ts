// Reads the active OpenSpec changes of a workspace from disk. Pure Node, no Orca API.
import type { Dirent } from 'node:fs'
import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { ArchivedChange, ArchivedChangeDetail, Artifact, Change, ChangeDetail, SpecSummary, TaskCount, TaskSection } from './protocol'

export const CHANGES_DIR = join('openspec', 'changes')
export const ARCHIVE_DIR = join(CHANGES_DIR, 'archive')
export const SPECS_DIR = join('openspec', 'specs')
const ARCHIVE = 'archive'
const ARCHIVE_PREFIX = /^(\d{4}-\d{2}-\d{2})-(.+)$/
// shortcut: capability paths deeper than 3 folders are not listed; raise it if a project needs more.
const SPEC_DEPTH = 3
const ARTIFACT_FILES: readonly Artifact[] = ['proposal.md', 'design.md', 'tasks.md']
// [ \t] instead of \s: \s crosses lines.
const TASK_LINE = /^[ \t]*[-*+][ \t]+\[([ xX])\][ \t]*(.*)$/
const HEADING_LINE = /^#{2,6}[ \t]+(.*)$/

/** The checkboxes of tasks.md grouped under their headings; empty sections are dropped. */
export function parseTasks(markdown: string): TaskSection[] {
  const sections: TaskSection[] = [{ title: '', tasks: [] }]
  for (const line of markdown.split(/\r?\n/)) {
    const heading = HEADING_LINE.exec(line)
    if (heading) {
      sections.push({ title: heading[1].trim(), tasks: [] })
      continue
    }
    const task = TASK_LINE.exec(line)
    if (task) sections[sections.length - 1].tasks.push({ done: task[1] !== ' ', text: task[2].trim() })
  }
  return sections.filter((section) => section.tasks.length > 0)
}

export function countSections(sections: readonly TaskSection[]): TaskCount {
  const tasks = sections.flatMap((section) => section.tasks)
  return { done: tasks.filter((task) => task.done).length, total: tasks.length }
}

/** Counts `- [x]` against `- [ ]` checkboxes (also `*`/`+` bullets and `[X]`). */
export function countTasks(markdown: string): TaskCount {
  return countSections(parseTasks(markdown))
}

async function readTasks(dir: string, files: Set<string>): Promise<TaskSection[] | null> {
  return files.has('tasks.md') ? parseTasks(await readFile(join(dir, 'tasks.md'), 'utf8')) : null
}

/** Newest `mtimeMs` of the files under `dir`; 0 when it has none. */
async function newestMtime(dir: string): Promise<number> {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true })
  const times = await Promise.all(
    entries.filter((e) => e.isFile()).map(async (e) => (await stat(join(e.parentPath, e.name))).mtimeMs)
  )
  return Math.max(0, ...times)
}

async function readChange(changesDir: string, name: string): Promise<Change & { sections: TaskSection[] | null }> {
  const dir = join(changesDir, name)
  const entries = await readdir(dir, { withFileTypes: true })
  const files = new Set(entries.filter((e) => e.isFile()).map((e) => e.name))
  const artifacts: Artifact[] = ARTIFACT_FILES.filter((file) => files.has(file))
  if (entries.some((e) => e.isDirectory() && e.name === 'specs')) artifacts.push('specs/')
  const [sections, updatedAt] = await Promise.all([readTasks(dir, files), newestMtime(dir)])
  return { name, artifacts, tasks: sections && countSections(sections), updatedAt, sections }
}

/** `readdir` that answers null for a missing folder and still throws any other error. */
async function readdirIfExists(dir: string): Promise<Dirent[] | null> {
  try {
    return await readdir(dir, { withFileTypes: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

async function activeNames(changesDir: string): Promise<string[] | null> {
  const entries = await readdirIfExists(changesDir)
  return (
    entries
      ?.filter((e) => e.isDirectory() && e.name !== ARCHIVE && !e.name.startsWith('.'))
      .map((e) => e.name)
      .sort() ?? null
  )
}

function splitFolder(folder: string): { name: string; date: string | null } {
  const match = ARCHIVE_PREFIX.exec(folder)
  return match ? { name: match[2], date: match[1] } : { name: folder, date: null }
}

/** Archive folders: dated ones newest first, then the undated ones by name. */
async function archiveFolders(root: string): Promise<string[]> {
  const entries = (await readdirIfExists(join(root, ARCHIVE_DIR))) ?? []
  const folders = entries.filter((e) => e.isDirectory() && !e.name.startsWith('.')).map((e) => e.name)
  const dated = folders.filter((f) => ARCHIVE_PREFIX.test(f)).sort().reverse()
  const undated = folders.filter((f) => !ARCHIVE_PREFIX.test(f)).sort()
  return [...dated, ...undated]
}

/** The active changes under `<root>/openspec/changes`, sorted by name; null when it is missing. */
export async function readChanges(root: string): Promise<Change[] | null> {
  const changesDir = join(root, CHANGES_DIR)
  const names = await activeNames(changesDir)
  if (!names) return null
  const changes = await Promise.all(names.map((name) => readChange(changesDir, name)))
  return changes.map(({ name, artifacts, tasks, updatedAt }) => ({ name, artifacts, tasks, updatedAt }))
}

/** `specs/<capability>/spec.md` of every capability folder that has one. */
async function readSpecs(changeDir: string): Promise<string[]> {
  const specsDir = join(changeDir, 'specs')
  const capabilities = await readdir(specsDir, { withFileTypes: true }).catch(() => [])
  const specs = await Promise.all(
    capabilities
      .filter((e) => e.isDirectory())
      .map(async (e) => {
        const files = await readdir(join(specsDir, e.name))
        return files.includes('spec.md') ? `specs/${e.name}/spec.md` : null
      })
  )
  return specs.filter((spec): spec is string => spec !== null).sort()
}

/**
 * One active change with its specs and tasks; null when it does not exist. `name` must be one of
 * the listed names, so a name from the panel can never point outside openspec/changes.
 */
export async function readChangeDetail(root: string, name: string): Promise<ChangeDetail | null> {
  const changesDir = join(root, CHANGES_DIR)
  if (!(await activeNames(changesDir))?.includes(name)) return null
  const change = await readChange(changesDir, name)
  return { ...change, sections: change.sections ?? [], specs: await readSpecs(join(changesDir, name)) }
}

export const countArchive = async (root: string): Promise<number> => (await archiveFolders(root)).length

/** The archived changes, newest first; empty when there is no archive. */
export async function readArchive(root: string): Promise<ArchivedChange[]> {
  const archiveDir = join(root, ARCHIVE_DIR)
  const folders = await archiveFolders(root)
  const changes = await Promise.all(folders.map((folder) => readChange(archiveDir, folder)))
  return changes.map(({ artifacts, tasks, updatedAt }, i) => ({
    ...splitFolder(folders[i]),
    folder: folders[i],
    artifacts,
    tasks,
    updatedAt
  }))
}

/** One archived change; null unless `folder` is one `readArchive` lists, so it cannot leave the archive. */
export async function readArchivedDetail(root: string, folder: string): Promise<ArchivedChangeDetail | null> {
  if (!(await archiveFolders(root)).includes(folder)) return null
  const archiveDir = join(root, ARCHIVE_DIR)
  const change = await readChange(archiveDir, folder)
  return {
    ...change,
    ...splitFolder(folder),
    folder,
    sections: change.sections ?? [],
    specs: await readSpecs(join(archiveDir, folder))
  }
}

async function walkSpecs(dir: string, prefix: string, depth: number): Promise<string[]> {
  const entries = (await readdirIfExists(dir)) ?? []
  const own = prefix && entries.some((e) => e.isFile() && e.name === 'spec.md') ? [prefix] : []
  if (depth === 0) return own
  const nested = await Promise.all(
    entries
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => walkSpecs(join(dir, e.name), prefix ? `${prefix}/${e.name}` : e.name, depth - 1))
  )
  return [...own, ...nested.flat()]
}

/** Capability folders of `openspec/specs/` that hold a spec.md, sorted; the only names `specs.open` accepts. */
export async function specCapabilities(root: string): Promise<string[]> {
  return (await walkSpecs(join(root, SPECS_DIR), '', SPEC_DEPTH)).sort()
}

export const countSpecs = async (root: string): Promise<number> => (await specCapabilities(root)).length

/** Purpose (first line under `## Purpose`) and number of requirements of a spec.md. */
export function parseSpec(markdown: string): { purpose: string | null; requirements: number } {
  const lines = markdown.split(/\r?\n/)
  const at = lines.findIndex((line) => /^##[ \t]+Purpose[ \t]*$/.test(line))
  const next = at === -1 ? undefined : lines.slice(at + 1).find((line) => line.trim() !== '')
  const purpose = next && !next.startsWith('#') ? next.trim() : null
  return { purpose, requirements: lines.filter((line) => /^###[ \t]+Requirement:/.test(line)).length }
}

export async function readSpecList(root: string): Promise<SpecSummary[]> {
  const capabilities = await specCapabilities(root)
  return Promise.all(
    capabilities.map(async (capability) => ({
      capability,
      ...parseSpec(await readFile(join(root, SPECS_DIR, capability, 'spec.md'), 'utf8'))
    }))
  )
}

/** Files of a change the panel may open, relative to the change folder. */
export function openableFiles(detail: ChangeDetail): string[] {
  const artifacts = detail.artifacts.filter((artifact) => artifact !== 'specs/')
  return [...artifacts, ...detail.specs]
}

/** The file a click on a change opens: tasks.md, else proposal.md, else null. */
export function fileToOpen(change: Change): string | null {
  if (change.artifacts.includes('tasks.md')) return 'tasks.md'
  if (change.artifacts.includes('proposal.md')) return 'proposal.md'
  return null
}
