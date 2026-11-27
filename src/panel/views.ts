// The header, the summary strip, the change cards, the first-prompt form and the empty states.
import type { ArchivedChange, Change, ChangesState, SpecSummary, TaskCount } from '../protocol'
import {
  changeState,
  actionButtons,
  nextStep,
  progressHue,
  relativeAge,
  STATE_LABEL,
  stateCounts,
  steps,
  STEPS,
  type ChangeState
} from '../state'
import { h, icon, ICONS, type Child } from './dom'
import type { Actions, FreeAction, PanelState, Tab } from './model'
import { formatDate } from './text'

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`

export function subtitle(list: ChangesState | null): string {
  if (!list) return 'Loading…'
  switch (list.status) {
    case 'no-workspace':
      return 'No workspace'
    case 'remote':
      return `${list.workspace} · remote`
    case 'no-openspec':
      return `${list.workspace} · No OpenSpec here`
    case 'ok':
      return `${list.workspace} · ${list.changes.length ? plural(list.changes.length, 'change') : 'No active changes'}`
  }
}

function iconButton(label: string, paths: readonly string[], onclick: () => void, disabled = false): HTMLElement {
  return h('button', { type: 'button', class: 'icon-button', 'aria-label': label, title: label, disabled, onclick }, [
    icon(paths)
  ])
}

export function header(state: PanelState, actions: Actions): HTMLElement {
  const canStart = state.list?.status === 'ok' && !state.starting
  return h('header', { class: 'header' }, [
    h('span', { class: 'tile' }, [icon(ICONS.layers, 14)]),
    h('h1', { class: 'title' }, [
      'OpenSpec Pulse',
      state.version ? h('span', { class: 'version' }, [`v${state.version}`]) : null
    ]),
    h('p', { class: 'subtitle', title: subtitle(state.list) }, [subtitle(state.list)]),
    h('div', { class: 'header-actions' }, [
      iconButton('New proposal', ICONS.plus, () => actions.openComposer('propose'), !canStart),
      iconButton('Explore', ICONS.lightbulb, () => actions.openComposer('explore'), !canStart),
      iconButton('Refresh', ICONS.refresh, () => actions.refresh())
    ])
  ])
}

export function strip(changes: readonly Change[], filter: ChangeState | null, actions: Actions): HTMLElement | null {
  const counts = stateCounts(changes)
  if (counts.length === 0) return null
  return h(
    'div',
    { class: 'strip', role: 'group', 'aria-label': 'Filter by state' },
    counts.map(({ state, count }) =>
      h(
        'button',
        {
          type: 'button',
          class: `state-${state}`,
          'aria-pressed': String(filter === state),
          onclick: () => actions.setFilter(filter === state ? null : state)
        },
        [h('span', { class: 'dot', 'aria-hidden': 'true' }), `${count} ${STATE_LABEL[state].toLowerCase()}`]
      )
    )
  )
}

const percent = ({ done, total }: TaskCount): number => (total ? Math.round((done / total) * 100) : 0)

export function progressBar(label: string, tasks: TaskCount): HTMLElement {
  const fill = h('span')
  fill.style.width = `${percent(tasks)}%`
  fill.style.setProperty('--hue', String(progressHue(tasks)))
  return h('div', { class: 'progress' }, [
    h(
      'div',
      {
        class: 'bar',
        role: 'progressbar',
        'aria-label': label,
        'aria-valuemin': 0,
        'aria-valuemax': tasks.total,
        'aria-valuenow': tasks.done,
        'aria-valuetext': `${tasks.done} of ${tasks.total} tasks done`
      },
      [fill]
    ),
    h('span', { class: 'count', 'aria-hidden': 'true' }, [`${tasks.done}/${tasks.total}`])
  ])
}

function stepper(change: Change): HTMLElement {
  const marks = steps(change)
  return h(
    'ol',
    { class: 'stepper', 'aria-label': 'Lifecycle' },
    STEPS.map((step) =>
      h('li', { 'data-mark': marks[step] }, [step, h('span', { class: 'sr-only' }, [` ${marks[step]}`])])
    )
  )
}

const ACTION_ICONS = {
  continue: ICONS.next,
  apply: ICONS.play,
  verify: ICONS.check,
  archive: ICONS.archive
} as const

/** Continue, apply, verify and archive as icon buttons; the next step is filled. */
function actionRow(change: Change, state: PanelState, actions: Actions): HTMLElement {
  const step = nextStep(change)
  return h(
    'div',
    { class: 'actions', role: 'group', 'aria-label': `Actions for ${change.name}` },
    actionButtons(change).map((button) =>
      h(
        'button',
        {
          type: 'button',
          class: button.primary ? 'action primary' : 'action secondary',
          disabled: button.disabled || state.starting,
          title: button.reason ?? (button.primary ? step.label : button.label),
          'aria-label': `${button.primary ? step.label : button.label} ${change.name}`,
          onclick: () => actions.run(button.action, change.name)
        },
        [icon(ACTION_ICONS[button.action], 14)]
      )
    )
  )
}

/** `archived` makes the card read-only: a muted stripe, an `Archived <date>` pill, no actions. */
export type CardOptions = { asHeading?: boolean; archived?: { date: string | null } }

/** The card of one change; in the detail view its name is the heading instead of a link. */
export function card(change: Change, state: PanelState, actions: Actions, { asHeading = false, archived }: CardOptions = {}): HTMLElement {
  const current = archived ? 'archived' : changeState(change)
  const pill = archived ? (archived.date ? `Archived ${formatDate(archived.date)}` : 'Archived') : STATE_LABEL[changeState(change)]
  const name: Child = asHeading
    ? h('h2', { class: 'card-name' }, [change.name])
    : h('button', { type: 'button', class: 'card-name', title: `Open ${change.name}`, onclick: () => actions.select(change.name) }, [
        change.name
      ])
  return h('article', { class: `card state-${current}`, 'aria-label': change.name }, [
    h('div', { class: 'card-head' }, [name, h('span', { class: 'pill' }, [pill])]),
    change.tasks && change.tasks.total > 0 ? progressBar(`${change.name} progress`, change.tasks) : null,
    stepper(change),
    h('div', { class: 'card-foot' }, [
      h('span', { class: 'age', 'data-updated': change.updatedAt }, [`edited ${relativeAge(change.updatedAt, Date.now())}`]),
      archived ? null : actionRow(change, state, actions)
    ])
  ])
}

/** Keeps the `edited … ago` texts current without redrawing. */
export function refreshAges(root: ParentNode): void {
  const now = Date.now()
  for (const el of root.querySelectorAll<HTMLElement>('.age[data-updated]')) {
    el.textContent = `edited ${relativeAge(Number(el.dataset.updated), now)}`
  }
}

const FORMS: Record<FreeAction, { title: string; label: string; placeholder: string }> = {
  propose: { title: 'New proposal', label: 'What do you want to change?', placeholder: 'Add a CSV export to the monthly report…' },
  explore: {
    title: 'Explore',
    label: 'What do you want to think through? (optional)',
    placeholder: 'How should we cache the API answers?'
  }
}

export function composer(state: PanelState, actions: Actions): HTMLElement | null {
  const action = state.composer
  if (!action) return null
  const form = FORMS[action]
  const canStart = !state.starting && (action === 'explore' || state.draft.trim() !== '')
  const textarea = h('textarea', {
    id: 'composer-text',
    'data-focus': 'composer',
    placeholder: form.placeholder,
    rows: 4,
    oninput: (event) => actions.setDraft((event.target as HTMLTextAreaElement).value),
    onkeydown: (event) => {
      const key = event as KeyboardEvent
      if (key.key === 'Enter' && (key.metaKey || key.ctrlKey)) {
        key.preventDefault()
        actions.submit()
      } else if (key.key === 'Escape') actions.closeComposer()
    }
  }) as HTMLTextAreaElement
  textarea.value = state.draft
  return h('section', { class: 'composer', 'aria-label': form.title }, [
    h('h2', {}, [form.title]),
    h('label', { for: 'composer-text' }, [form.label]),
    textarea,
    h('p', { class: 'hint message' }, [
      `Runs /openspec-${action} in an idle Claude Code terminal, or a new chat. Cmd+Enter to start.`
    ]),
    h('div', { class: 'row-end' }, [
      h('button', { type: 'button', class: 'secondary', onclick: () => actions.closeComposer() }, ['Cancel']),
      h('button', { type: 'button', class: 'primary', disabled: !canStart, onclick: () => actions.submit() }, [
        state.starting ? 'Starting…' : 'Start'
      ])
    ])
  ])
}

const TAB_LABELS: Record<Tab, string> = { active: 'Active', archive: 'Archive', specs: 'Specs' }

/** Active · Archive · Specs with their counts; only for a workspace that has OpenSpec. */
export function tabBar(state: PanelState, actions: Actions): HTMLElement | null {
  const list = state.list
  if (list?.status !== 'ok') return null
  const counts: Record<Tab, number> = { active: list.changes.length, archive: list.archived, specs: list.specs }
  return h(
    'div',
    { class: 'tabs', role: 'tablist', 'aria-label': 'OpenSpec views' },
    (Object.keys(TAB_LABELS) as Tab[]).map((tab) =>
      h(
        'button',
        {
          type: 'button',
          role: 'tab',
          class: 'tab',
          'data-focus': `tab:${tab}`,
          'aria-selected': String(state.tab === tab),
          onclick: () => actions.setTab(tab)
        },
        [TAB_LABELS[tab], h('span', { class: 'tab-count' }, [String(counts[tab])])]
      )
    )
  )
}

function archiveRow(change: ArchivedChange, actions: Actions): HTMLElement {
  const tasks = change.tasks ? `${change.tasks.done}/${change.tasks.total}` : 'no tasks'
  return h('button', { type: 'button', class: 'row', title: `Open ${change.name}`, onclick: () => actions.openArchived(change.folder) }, [
    h('span', { class: 'row-name' }, [change.name]),
    h('span', { class: 'row-meta' }, [change.date ? formatDate(change.date) : '']),
    h('span', { class: 'row-count' }, [tasks])
  ])
}

export function archiveView(state: PanelState, actions: Actions): Child[] {
  if (!state.archive) return [h('p', { class: 'muted message' }, ['Loading archive…'])]
  if (state.archive.length === 0) {
    return [empty('No archived changes', 'A change moves here when it is archived with /openspec-archive.')]
  }
  return [h('div', { class: 'body-list' }, state.archive.map((change) => archiveRow(change, actions)))]
}

function specRow(spec: SpecSummary, actions: Actions): HTMLElement {
  return h('button', { type: 'button', class: 'row spec-row', title: `Open ${spec.capability}`, onclick: () => actions.openSpec(spec.capability) }, [
    h('span', { class: 'row-name' }, [spec.capability]),
    h('span', { class: 'row-count' }, [plural(spec.requirements, 'requirement')]),
    spec.purpose ? h('span', { class: 'row-purpose muted' }, [spec.purpose]) : null
  ])
}

export function specsView(state: PanelState, actions: Actions): Child[] {
  if (!state.specs) return [h('p', { class: 'muted message' }, ['Loading specs…'])]
  if (state.specs.length === 0) {
    return [empty('No specs yet', 'Archiving a change creates the specs in openspec/specs/.')]
  }
  return [h('div', { class: 'body-list' }, state.specs.map((spec) => specRow(spec, actions)))]
}

function empty(title: string, text: string, ...extra: Child[]): HTMLElement {
  return h('div', { class: 'empty' }, [h('h2', {}, [title]), h('p', {}, [text]), ...extra])
}

/** The list view below the header. */
export function listView(state: PanelState, actions: Actions): Child[] {
  const list = state.list
  if (!list) return [h('p', { class: 'muted message' }, ['Loading changes…'])]
  switch (list.status) {
    case 'no-workspace':
      return [empty('No workspace', 'Open a workspace to see its OpenSpec changes.')]
    case 'remote':
      return [empty('Remote workspace', `${list.workspace} is on another host; only local workspaces are read.`)]
    case 'no-openspec':
      return [
        empty(
          'No OpenSpec here',
          `${list.workspace} has no openspec/changes/ folder. Initializing runs \`openspec init --tools none\`, which only creates openspec/.`,
          h('button', { type: 'button', class: 'primary', disabled: state.initializing, onclick: () => actions.initialize() }, [
            state.initializing ? 'Initializing…' : 'Initialize OpenSpec'
          ])
        )
      ]
    case 'ok': {
      if (state.tab === 'archive') return archiveView(state, actions)
      if (state.tab === 'specs') return specsView(state, actions)
      const sorted = [...list.changes].sort((a, b) => b.updatedAt - a.updatedAt)
      const shown = state.filter ? sorted.filter((c) => changeState(c) === state.filter) : sorted
      return [
        composer(state, actions),
        strip(list.changes, state.filter, actions),
        list.changes.length === 0
          ? empty('No active changes', 'openspec/changes/ only holds the archive. Press + to propose one.')
          : h('div', { class: 'body-list' }, shown.map((change) => card(change, state, actions)))
      ]
    }
  }
}
