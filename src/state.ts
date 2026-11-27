import { t, uiLocale } from './i18n'
// State, next step and summaries of OpenSpec changes, shared by the panel and the worker so the
// strip, the cards and the status bar always agree. Pure: no Orca or DOM imports.
import type { AgentAction, Change, ChangesState, TaskCount } from './protocol'

export type ChangeState = 'drafting' | 'not-started' | 'in-progress' | 'done'
export type Step = 'proposal' | 'specs' | 'design' | 'tasks'
export type StepMark = 'done' | 'missing' | 'next'
export type ChangeAction = Extract<AgentAction, 'continue' | 'apply' | 'verify' | 'archive'>
export type NextStep = { action: ChangeAction; label: string }
export type ActionButton = { action: ChangeAction; label: string; primary: boolean; disabled: boolean; reason?: string }
export type StateCount = { state: ChangeState; count: number }
export type StatusBarSummary =
  | { visible: false }
  | { visible: true; text: string; tone: 'neutral' | 'accent' | 'success'; tooltip: string }

export const STEPS: readonly Step[] = ['proposal', 'specs', 'design', 'tasks']
const STEP_ARTIFACT = { proposal: 'proposal.md', specs: 'specs/', design: 'design.md', tasks: 'tasks.md' } as const
/** The summary strip's order. */
export const STATE_ORDER: readonly ChangeState[] = ['in-progress', 'not-started', 'drafting', 'done']
export const STATE_LABEL: Record<ChangeState, string> = {
  get drafting() { return t('Drafting') },
  get 'not-started'() { return t('Not started') },
  get 'in-progress'() { return t('In progress') },
  get done() { return t('Done') }
}
const actionLabels = (): Record<ChangeAction, string> => ({ continue: t('Continue'), apply: t('Apply'), verify: t('Verify'), archive: t('Archive') })
const ACTION_ORDER: readonly ChangeAction[] = ['continue', 'apply', 'verify', 'archive']
export const TOOLTIP_MAX_CHARS = 256

const hasTasks = (change: Change): boolean => (change.tasks?.total ?? 0) > 0

export function changeState(change: Change): ChangeState {
  const tasks = change.tasks
  if (change.missingArtifacts?.length || !tasks || tasks.total === 0) return 'drafting'
  if (tasks.done === 0) return 'not-started'
  return tasks.done === tasks.total ? 'done' : 'in-progress'
}

/** Each lifecycle step done or missing; while tasks.md is missing, the first missing one is next. */
export function steps(change: Change): Record<Step, StepMark> {
  const marks = Object.fromEntries(
    STEPS.map((step) => [step, change.artifacts.includes(STEP_ARTIFACT[step]) ? 'done' : 'missing'])
  ) as Record<Step, StepMark>
  const next = marks.tasks === 'missing' ? STEPS.find((step) => marks[step] === 'missing') : undefined
  return next ? { ...marks, [next]: 'next' } : marks
}

/** The one primary action: continue while planning, apply while tasks are pending, then archive. */
export function nextStep(change: Change): NextStep {
  if (change.missingArtifacts?.length) return { action: 'continue', label: t('Continue: {p0}', { p0: change.missingArtifacts[0] }) }
  const next = STEPS.find((step) => steps(change)[step] === 'next')
  if (next) return { action: 'continue', label: t('Continue: {p0}', { p0: t(next) }) }
  // shortcut: a tasks.md without checkboxes has nothing to apply, so the agent continues planning.
  if (!hasTasks(change)) return { action: 'continue', label: t('Continue') }
  return changeState(change) === 'done' ? { action: 'archive', label: t('Archive') } : { action: 'apply', label: t('Apply') }
}

/** The four actions of a change, the next step marked primary; apply and verify need tasks. */
export function actionButtons(change: Change): ActionButton[] {
  const primary = nextStep(change).action
  const tasks = hasTasks(change)
  return ACTION_ORDER.map((action) => {
    const button = { action, label: actionLabels()[action], primary: action === primary }
    const needsTasks = action === 'apply' || action === 'verify'
    return needsTasks && !tasks
      ? { ...button, disabled: true, reason: t('Needs tasks in tasks.md') }
      : { ...button, disabled: false }
  })
}

/** Hue of a progress bar: red (0) at 0% through orange and yellow to green (120) at 100%. */
export function progressHue({ done, total }: TaskCount): number {
  return total > 0 ? Math.round((Math.min(done, total) / total) * 120) : 0
}

/** Non-zero counts per state, in the strip's order. */
export function stateCounts(changes: readonly Change[]): StateCount[] {
  return STATE_ORDER.map((state) => ({ state, count: changes.filter((c) => changeState(c) === state).length })).filter(
    (item) => item.count > 0
  )
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** `just now`, `5 min ago`, `3 h ago` or `2 d ago`. */
export function relativeAge(ms: number, now: number): string {
  const age = Math.max(0, now - ms)
  if (age < MINUTE) return t('just now')
  const [unit, duration] = age < HOUR ? ['minute', MINUTE] as const : age < DAY ? ['hour', HOUR] as const : ['day', DAY] as const
  if (uiLocale() === 'en') return age < HOUR ? t('{p0} min ago', { p0: Math.floor(age / duration) }) : age < DAY ? t('{p0} h ago', { p0: Math.floor(age / duration) }) : t('{p0} d ago', { p0: Math.floor(age / duration) })
  return new Intl.RelativeTimeFormat(uiLocale(), { numeric: 'auto', style: 'short' }).format(-Math.floor(age / duration), unit)
}

/** Lines that fit in the limit, ending with `+N` instead of cutting a line. */
function fitLines(head: string, lines: readonly string[], max: number): string {
  let text = head
  for (const [index, line] of lines.entries()) {
    const rest = lines.length - index - 1
    const more = rest > 0 ? `\n+${rest}` : ''
    if ((text + '\n' + line + more).length > max) return `${text}\n+${lines.length - index}`
    text += '\n' + line
  }
  return text
}

/** The status bar item for a `changes.list` answer: hidden unless OpenSpec could be read. */
export function statusBarSummary(list: ChangesState): StatusBarSummary {
  if (list.status !== 'ok') return { visible: false }
  const { changes, workspace } = list
  const done = changes.reduce((sum, c) => sum + (c.tasks?.done ?? 0), 0)
  const total = changes.reduce((sum, c) => sum + (c.tasks?.total ?? 0), 0)
  const text = `OpenSpec · ${changes.length}${total > 0 ? ` · ${done}/${total}` : ''}`
  const tone = total === 0 ? 'neutral' : done === total ? 'success' : 'accent'
  const lines = changes.length
    ? changes.map((c) => `${c.name} ${hasTasks(c) ? `${c.tasks!.done}/${c.tasks!.total}` : '—'}`)
    : ['—']
  return { visible: true, text, tone, tooltip: fitLines(`OpenSpec · ${workspace}`, lines, TOOLTIP_MAX_CHARS) }
}

// Colour checks. The panel's CSS (src/panel/panel.css) uses the same `done` greens; the other
// states take Orca's theme variables.
/** `--state-done` per theme, picked for 4.5:1 on its pill. */
export const DONE_GREEN = { light: '#166534', dark: '#3fb950' } as const
/** Share of the state colour in a pill's background (`color-mix`). */
export const PILL_MIX = 0.15

const channels = (hex: string): number[] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

/** `color-mix(in srgb, a share, b)` for `#rrggbb` colours. */
export function mixHex(a: string, b: string, share: number): string {
  const bb = channels(b)
  const mixed = channels(a).map((v, i) => Math.round(v * share + bb[i] * (1 - share)))
  return `#${mixed.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG 2 contrast ratio of two `#rrggbb` colours. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
