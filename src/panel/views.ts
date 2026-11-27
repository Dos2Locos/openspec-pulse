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
import { composer } from './launch'
import type { Actions, PanelState, Tab } from './model'
import { filterActive, filterArchive, filterSpecs, page, PAGE_SIZE } from './search'
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

const SEARCH_LABEL: Record<Tab, string> = {
  active: 'Search changes by name',
  archive: 'Search archived changes by name',
  specs: 'Search specs by path or purpose'
}

/** The search box of a tab; `data-focus` keeps focus and caret while the list redraws. */
function searchBox(tab: Tab, state: PanelState, actions: Actions, shown: number, total: number): HTMLElement {
  const query = state.queries[tab]
  return h('div', { class: 'search', role: 'search' }, [
    h('input', {
      type: 'search',
      class: 'search-input',
      'data-focus': `search:${tab}`,
      'aria-label': SEARCH_LABEL[tab],
      placeholder: SEARCH_LABEL[tab],
      autocomplete: 'off',
      spellcheck: 'false',
      value: query,
      oninput: (event: Event) => actions.setQuery(tab, (event.target as HTMLInputElement).value)
    }),
    query.trim() || (tab === 'active' && state.filter)
      ? h('span', { class: 'search-count muted', role: 'status' }, [`${shown} of ${total}`])
      : null
  ])
}

/** The rows of the first pages and the Load more control; `noun` names what is counted. */
function pagedList<T>(tab: Tab, state: PanelState, actions: Actions, items: readonly T[], row: (item: T) => Node, noun: string): Child[] {
  const { shown, remaining } = page(items, state.limits[tab])
  return [
    h('div', { class: 'body-list' }, shown.map(row)),
    remaining > 0
      ? h(
          'button',
          {
            type: 'button',
            class: 'secondary load-more',
            'data-focus': `more:${tab}`,
            onclick: () => actions.loadMore(tab)
          },
          [`Load more (${Math.min(PAGE_SIZE, remaining)} of ${remaining} ${noun} left)`]
        )
      : null
  ]
}

/** No row matches the search: say so and offer to clear it. */
function noMatches(tab: Tab, state: PanelState, actions: Actions): HTMLElement {
  const filtered = tab === 'active' && state.filter !== null
  return empty(
    'No results',
    state.queries[tab].trim() ? `Nothing matches “${state.queries[tab].trim()}”.` : 'No change has the selected state.',
    h(
      'button',
      {
        type: 'button',
        class: 'secondary',
        'data-focus': `clear:${tab}`,
        onclick: () => {
          actions.setQuery(tab, '')
          if (filtered) actions.setFilter(null)
        }
      },
      [filtered ? 'Clear search and filter' : 'Clear search']
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
  const found = filterArchive(state.archive, state.queries.archive)
  return [
    searchBox('archive', state, actions, found.length, state.archive.length),
    ...(found.length === 0
      ? [noMatches('archive', state, actions)]
      : pagedList('archive', state, actions, found, (change) => archiveRow(change, actions), 'changes'))
  ]
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
  const found = filterSpecs(state.specs, state.queries.specs)
  return [
    searchBox('specs', state, actions, found.length, state.specs.length),
    ...(found.length === 0
      ? [noMatches('specs', state, actions)]
      : pagedList('specs', state, actions, found, (spec) => specRow(spec, actions), 'specs'))
  ]
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
      const found = filterActive(list.changes, state.queries.active, state.filter, changeState)
      return [
        composer(state, actions),
        list.changes.length === 0 ? null : searchBox('active', state, actions, found.length, list.changes.length),
        strip(list.changes, state.filter, actions),
        ...(list.changes.length === 0
          ? [empty('No active changes', 'openspec/changes/ only holds the archive. Press + to propose one.')]
          : found.length === 0
            ? [noMatches('active', state, actions)]
            : pagedList('active', state, actions, found, (change) => card(change, state, actions), 'changes'))
      ]
    }
  }
}
