import { readFile } from 'node:fs/promises'
import { assert, test } from 'orca/testing'
import type { Artifact, Change } from './protocol'
import {
  changeState,
  contrastRatio,
  DONE_GREEN,
  actionButtons,
  mixHex,
  nextStep,
  PILL_MIX,
  progressHue,
  relativeAge,
  stateCounts,
  statusBarSummary,
  steps,
  TOOLTIP_MAX_CHARS
} from './state'

const change = (name: string, artifacts: Artifact[], tasks: [number, number] | null = null): Change => ({
  name,
  artifacts,
  tasks: tasks && { done: tasks[0], total: tasks[1] },
  updatedAt: 0
})
const ALL: Artifact[] = ['proposal.md', 'specs/', 'design.md', 'tasks.md']

test('classifies drafting, not started, in progress and done', () => {
  const states = [
    change('a', ['proposal.md']),
    change('b', ALL, [0, 4]),
    change('c', ALL, [2, 4]),
    change('d', ALL, [4, 4]),
    change('e', ALL, [0, 0])
  ].map(changeState)
  assert.deepEqual(states, ['drafting', 'not-started', 'in-progress', 'done', 'drafting'])
})

test('marks the stepper and the next step', () => {
  assert.deepEqual(steps(change('a', ['proposal.md', 'specs/'])), {
    proposal: 'done',
    specs: 'done',
    design: 'next',
    tasks: 'missing'
  })
  // Design skipped: no step is next once tasks.md exists, and the change counts as planned.
  const skipped = change('b', ['proposal.md', 'specs/', 'tasks.md'], [0, 3])
  assert.deepEqual(steps(skipped), { proposal: 'done', specs: 'done', design: 'missing', tasks: 'done' })
  assert.deepEqual(nextStep(skipped), { action: 'apply', label: 'Apply' })
})

test('names the primary action after the next step', () => {
  const labels = [
    change('a', ['proposal.md', 'specs/']),
    change('b', ALL, [2, 5]),
    change('c', ALL, [0, 5]),
    change('d', ALL, [5, 5])
  ].map((c) => nextStep(c))
  assert.deepEqual(labels, [
    { action: 'continue', label: 'Continue: design' },
    { action: 'apply', label: 'Apply' },
    { action: 'apply', label: 'Apply' },
    { action: 'archive', label: 'Archive' }
  ])
  assert.deepEqual(nextStep(change('e', [])), { action: 'continue', label: 'Continue: proposal' })
})

test('shows the four actions, the next step primary, apply and verify needing tasks', () => {
  const marks = (c: Change) => actionButtons(c).map((b) => `${b.action}${b.primary ? '*' : ''}${b.disabled ? '-' : ''}`)
  assert.deepEqual(marks(change('a', ALL, [1, 3])), ['continue', 'apply*', 'verify', 'archive'])
  assert.deepEqual(marks(change('b', ['proposal.md'])), ['continue*', 'apply-', 'verify-', 'archive'])
  assert.deepEqual(marks(change('c', ALL, [3, 3])), ['continue', 'apply', 'verify', 'archive*'])
})

test('colours progress from red through yellow to green', () => {
  assert.deepEqual(
    [[0, 4], [1, 4], [2, 4], [3, 4], [4, 4], [0, 0], [5, 4]].map(([done, total]) => progressHue({ done, total })),
    [0, 30, 60, 90, 120, 0, 120]
  )
})

test('counts states in the strip order and leaves zeros out', () => {
  const counts = stateCounts([
    change('a', ALL, [4, 4]),
    change('b', ALL, [1, 4]),
    change('c', ALL, [2, 4]),
    change('d', ['proposal.md'])
  ])
  assert.deepEqual(counts, [
    { state: 'in-progress', count: 2 },
    { state: 'drafting', count: 1 },
    { state: 'done', count: 1 }
  ])
  assert.deepEqual(stateCounts([]), [])
})

test('says how long ago a change was edited', () => {
  const now = 10 * 86_400_000
  assert.equal(relativeAge(now - 20_000, now), 'just now')
  assert.equal(relativeAge(now - 5 * 60_000, now), '5 min ago')
  assert.equal(relativeAge(now - 2 * 3_600_000, now), '2 h ago')
  assert.equal(relativeAge(now - 3 * 86_400_000, now), '3 d ago')
  assert.equal(relativeAge(now + 5_000, now), 'just now')
})

test('summarises the workspace for the status bar', () => {
  const ok = (changes: Change[]) => statusBarSummary({ status: 'ok', workspace: 'repo', changes, archived: 0, specs: 0 })
  assert.deepEqual(ok([change('a', ALL, [3, 7]), change('b', ALL, [2, 5])]), {
    visible: true,
    text: '2 changes · 5/12',
    tone: 'accent',
    tooltip: 'OpenSpec · repo\na 3/7\nb 2/5'
  })
  const one = ok([change('a', ALL, [1, 4])])
  assert.equal(one.visible && one.text, '1 change · 1/4')
  const done = ok([change('a', ALL, [12, 12])])
  assert.equal(done.visible && done.tone, 'success')
  const noTasks = ok([change('a', ['proposal.md']), change('b', ['proposal.md'])])
  assert.equal(noTasks.visible && `${noTasks.text} ${noTasks.tone}`, '2 changes neutral')
  const none = ok([])
  assert.equal(none.visible && `${none.text} ${none.tone}`, 'No changes neutral')
  const tooltip = ok([change('add-x', ALL, [1, 2]), change('fix-y', ['proposal.md'])])
  assert.equal(tooltip.visible && tooltip.tooltip, 'OpenSpec · repo\nadd-x 1/2\nfix-y no tasks')
})

test('ends a long tooltip with +N more instead of cutting a line', () => {
  const many = Array.from({ length: 30 }, (_, i) => change(`change-number-${String(i).padStart(2, '0')}`, ALL, [1, 2]))
  const summary = statusBarSummary({ status: 'ok', workspace: 'repo', changes: many, archived: 0, specs: 0 })
  assert.ok(summary.visible)
  assert.ok(summary.tooltip.length <= TOOLTIP_MAX_CHARS, `${summary.tooltip.length} chars`)
  const lines = summary.tooltip.split('\n')
  const shown = lines.length - 2 // the heading and +N more
  assert.equal(lines.at(-1), `+${30 - shown} more`)
  assert.ok(lines.slice(1, -1).every((line) => /^change-number-\d\d 1\/2$/.test(line)))
})

test('hides the status bar item without readable OpenSpec', () => {
  for (const list of [
    { status: 'no-workspace' as const },
    { status: 'remote' as const, workspace: 'r' },
    { status: 'no-openspec' as const, workspace: 'r' }
  ]) {
    assert.deepEqual(statusBarSummary(list), { visible: false })
  }
})

// Orca's built-in theme (client CSS of Orca 1.4.277): --card, --primary and --muted-foreground.
const ORCA_DEFAULTS = {
  light: { card: '#ffffff', progress: '#171717', idle: '#696969' },
  dark: { card: '#171717', progress: '#e5e5e5', idle: '#acacac' }
} as const

test('every state pill reaches 4.5:1 in both default themes', () => {
  for (const theme of ['light', 'dark'] as const) {
    const { card, progress, idle } = ORCA_DEFAULTS[theme]
    for (const [state, colour] of [['progress', progress], ['done', DONE_GREEN[theme]], ['idle', idle]]) {
      const pill = mixHex(colour, card, PILL_MIX)
      const ratio = contrastRatio(colour, pill)
      assert.ok(ratio >= 4.5, `${theme} ${state}: ${colour} on ${pill} is ${ratio.toFixed(2)}:1`)
      // A `done` card is tinted at 6%: its counts must still read.
      if (state === 'done') assert.ok(contrastRatio(colour, mixHex(colour, card, 0.06)) >= 4.5)
    }
  }
  assert.equal(contrastRatio('#000000', '#ffffff').toFixed(0), '21')
})

test('the panel CSS uses the checked done greens', async () => {
  const css = await readFile(new URL('./panel/panel.css', import.meta.url), 'utf8')
  assert.match(css, new RegExp(`:root \\{[^}]*--state-done: ${DONE_GREEN.light};`))
  assert.match(css, new RegExp(`html\\.dark \\{[^}]*--state-done: ${DONE_GREEN.dark};`))
})
