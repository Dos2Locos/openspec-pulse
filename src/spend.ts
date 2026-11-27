import { t } from './i18n'
// Pure recorded-spend contract. No pricing lookup or inferred billing.
export type RunsConfig = { file?: string; folders?: string[] }
export type Run = { id?: string; at?: string; task?: string; model?: string; agentType?: string; costUsd?: number; inputTokens?: number; outputTokens?: number }
export type SpendFile = { identity: string; namespace?: string; unattributed?: boolean; lines: string[]; truncated: boolean }
export type SpendTotal = { events: number; knownCosts: number; unknownCosts: number; costUsd: number; inputTokens: number; outputTokens: number }
export type SpendSnapshot = {
  enabled: boolean; identity: string; total: SpendTotal
  byTask: Record<string, SpendTotal>; byModel: Record<string, SpendTotal>; byMonth: Record<string, SpendTotal>
  diagnostics: { files: number; truncated: number; discarded: number; duplicates: number; conflicts: number; withoutId: number; excluded: number }
  unattributed?: SpendSnapshot
  warnings: string[]
  /** Real project values that coincide with synthetic missing-data labels stay literal. */
  literalGroups?: Partial<Record<'byTask' | 'byModel' | 'byMonth', string[]>>
}
export const RUN_MAX_BYTES = 16 * 1024 * 1024
export const RUN_MAX_LINES = 20_000
export function relativeRunPath(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 512 &&
    !/^[a-z]:/i.test(value) && !/[\\\u0000-\u001f]/.test(value) && !value.startsWith('/') &&
    value.split('/').every(part => !!part && part !== '.' && part !== '..')
}
export function validateRuns(value: unknown): asserts value is RunsConfig | false {
  if (value === false) return
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(t("runs must be false or an object."))
  const v = value as Record<string, unknown>
  if (Object.keys(v).some(k => !['file', 'folders'].includes(k)) ||
      ('file' in v && !relativeRunPath(v.file)) ||
      ('folders' in v && (!Array.isArray(v.folders) || v.folders.length > 32 || !v.folders.every(relativeRunPath)))) throw new Error(t("runs paths must be relative and remain inside the approved root."))
}
export function parseRun(line: string): Run | null {
  try {
    const v = JSON.parse(line)
    if (!v || typeof v !== 'object' || Array.isArray(v)) return null
    const run: Run = {}
    for (const key of ['id', 'at', 'task', 'model', 'agentType'] as const) {
      if (key in v) {
        if (typeof v[key] !== 'string' || v[key].length > 512) return null
        if (v[key].trim()) run[key] = v[key]
      }
    }
    for (const key of ['costUsd', 'inputTokens', 'outputTokens'] as const) {
      if (!(key in v)) continue
      if (typeof v[key] !== 'number' || !Number.isFinite(v[key]) || v[key] < 0 ||
          (key !== 'costUsd' && !Number.isSafeInteger(v[key]))) return null
      run[key] = v[key]
    }
    return ['costUsd', 'inputTokens', 'outputTokens'].some(k => k in run) ? run : null
  } catch { return null }
}
const empty = (): SpendTotal => ({ events: 0, knownCosts: 0, unknownCosts: 0, costUsd: 0, inputTokens: 0, outputTokens: 0 })
function add(total: SpendTotal, run: Run): void {
  total.events++
  if (run.costUsd === undefined) total.unknownCosts++
  else { total.knownCosts++; total.costUsd += run.costUsd }
  total.inputTokens += run.inputTokens ?? 0
  total.outputTokens += run.outputTokens ?? 0
}
export function aggregateSpend(identity: string, files: SpendFile[], enabled = true): SpendSnapshot {
  const snapshot: SpendSnapshot = { enabled, identity, total: empty(), byTask: Object.create(null), byModel: Object.create(null), byMonth: Object.create(null),
    diagnostics: { files: 0, truncated: 0, discarded: 0, duplicates: 0, conflicts: 0, withoutId: 0, excluded: 0 }, warnings: [] }
  const seenFiles = new Set<string>(), ids = new Map<string, string>()
  for (const file of [...files].sort((a, b) => Number(!!a.unattributed) - Number(!!b.unattributed))) {
    if (file.unattributed) snapshot.unattributed ??= aggregateSpend(identity + ":unattributed", [])
    const target = file.unattributed ? snapshot.unattributed! : snapshot
    if (seenFiles.has(file.identity)) continue
    seenFiles.add(file.identity); target.diagnostics.files++
    if (file.truncated) target.diagnostics.truncated++
    for (const line of file.lines) {
      if (!line.trim()) continue
      const run = parseRun(line)
      if (!run) { target.diagnostics.discarded++; continue }
      const content = JSON.stringify(run)
      const id = JSON.stringify([file.namespace ?? "", run.id])
      if (run.id) {
        if (ids.has(id)) {
          target.diagnostics.duplicates++
          if (ids.get(id) !== content) target.diagnostics.conflicts++
          continue
        }
        ids.set(id, content)
      } else target.diagnostics.withoutId++
      add(target.total, run)
      for (const [group, value, missing] of [['byTask', run.task, '__pulse_no_task__'], ['byModel', run.model, '__pulse_no_model__']] as const) {
        if (value === missing) {
          target.literalGroups ??= {}
          const labels = target.literalGroups[group] ??= []
          if (!labels.includes(value)) labels.push(value)
        }
      }
      const month = run.at && Number.isFinite(Date.parse(run.at)) ? new Date(run.at).toISOString().slice(0, 7) : '__pulse_no_date__'
      for (const [groups, key] of [[target.byTask, run.task ?? '__pulse_no_task__'], [target.byModel, run.model ?? '__pulse_no_model__'], [target.byMonth, month]] as const) {
        groups[key] ??= empty(); add(groups[key], run)
      }
    }
  }
  return snapshot
}
