import { t, number, uiLocale, ownOrderingDiagnostic } from '../i18n'
import { storeControls } from './stores'
import { spendView } from './spend'
import { usageView } from './usage'
import { deliveryCard } from './delivery'
import { boardColumns } from '../board/model'
// The header, the summary strip, the change cards, the first-prompt form and the empty states.
import { worktreeItemKey } from '../worktree-key'
import { dependencyOrder } from '../ordering'
import type { ArchivedChange, Change, ChangesState, SpecSummary, TaskCount, WorktreeOrigin } from '../protocol'
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
import type { Actions, PanelState, Tab, ListTab } from './model'
import { filterActive, filterArchive, filterSpecs, page, PAGE_SIZE } from './search'
import { formatDate } from './text'

const plural = (n: number, _word: string): string => new Intl.PluralRules(uiLocale()).select(n) === 'one' ? t('{p0} change', { p0: n }) : t('{p0} changes', { p0: n })

export function subtitle(list: ChangesState | null): string {
  if (!list) return t("Loading…")
  switch (list.status) {
    case 'no-workspace':
      return t("No workspace")
    case 'remote':
      return `${list.workspace} · ${t('Remote')}`
    case 'no-openspec':
      return t("{p0} · No OpenSpec here", { p0: list.workspace })
    case 'ok':
      return `${list.workspace} · ${list.changes.length ? plural(list.changes.length, 'change') : t("No active changes")}`
  }
}

function iconButton(label: string, paths: readonly string[], onclick: () => void, disabled = false, focus?: string): HTMLElement {
  return h('button', { type: 'button', class: 'icon-button', 'data-focus': focus, 'aria-label': label, title: label, disabled, onclick }, [
    icon(paths)
  ])
}

export function header(state: PanelState, actions: Actions): HTMLElement {
  const canStart = state.list?.status === 'ok' && state.list.root?.kind !== 'store' && !state.starting && (!state.scope || state.scope === 'focused')
  return h('header', { class: 'header' }, [
    h('span', { class: 'tile' }, [icon(ICONS.layers, 14)]),
    h('h1', { class: 'title' }, [
      'OpenSpec Pulse',
      state.version ? h('span', { class: 'version' }, [`v${state.version}`]) : null
    ]),
    h('p', { class: 'subtitle', title: subtitle(state.list) }, [subtitle(state.list)]),
    h('div', { class: 'header-actions' }, [
      !state.board ? iconButton(t("Open board"), ICONS.layers, actions.openBoard, !state.browse, 'header:board') : null,
      iconButton(t("New proposal"), ICONS.plus, () => actions.openComposer('propose'), !canStart, 'header:propose'),
      iconButton(t("Explore"), ICONS.lightbulb, () => actions.openComposer('explore'), !canStart, 'header:explore'),
      iconButton(t("Refresh"), ICONS.refresh, () => actions.refresh(), false, 'header:refresh')
    ])
  ])
}

export function worktreeSelector(state: PanelState, actions: Actions): HTMLElement {
  const browse = state.browse
  return h('div', { class: 'worktree-control' }, [
    h('label', { class: 'worktree-picker' }, [
      icon(ICONS.layers, 13), h('span', { class: 'sr-only' }, [t("Worktrees")]),
      h('select', { 'aria-label': t("Worktree scope"), 'data-focus': 'worktree-scope', disabled: !browse,
        onchange: (event: Event) => actions.setScope((event.target as HTMLSelectElement).value) }, [
        h('option', { value: 'focused', selected: !state.scope || state.scope === 'focused' }, [t("This worktree")]),
        ...(browse?.worktrees.filter(w => w.workspaceId !== browse.focusedWorkspaceId).map(w => h('option', {
          value: w.workspaceId, selected: state.scope === w.workspaceId
        }, [`${w.name} · ${w.branch ?? t("Detached / unknown branch")}`])) ?? []),
        h('option', { value: 'all', selected: state.scope === 'all' }, [t("All worktrees")])
      ])
    ]),
    browse?.diagnostics.length ? h('details', { class: 'worktree-diagnostics' }, [
      h('summary', { 'data-focus': 'worktree-diagnostics' }, [t("Discovery notices: {p0}", { p0: browse.diagnostics.length })]),
      h('p', {}, [t("Some registered workspaces could not be checked. Only verified siblings are shown.")]),
      h('ul', {}, browse.diagnostics.map(text => h('li', {}, [text])))
    ]) : null
  ])
}

function originLabel(origin?: WorktreeOrigin): HTMLElement | null {
  return origin ? h('span', { class: 'worktree-origin' }, [`${origin.name} · ${origin.branch ?? t("Detached / unknown branch")}`]) : null
}

const itemKey = (item: Change): string => item.origin ? worktreeItemKey(item.origin.workspaceId, 'active', item.name) : item.name
const foreign = (item: Change, state: PanelState): boolean => !!item.origin && item.origin.workspaceId !== state.browse?.focusedWorkspaceId

export function strip(changes: readonly Change[], filter: ChangeState | null, actions: Actions): HTMLElement | null {
  const counts = stateCounts(changes)
  if (counts.length === 0) return null
  return h(
    'div',
    { class: 'strip', role: 'group', 'aria-label': t("Filter by state") },
    counts.map(({ state, count }) =>
      h(
        'button',
        {
          type: 'button',
          class: `state-${state}`,
          'data-focus': `filter:${state}`,
          'aria-pressed': String(filter === state),
          onclick: () => actions.setFilter(filter === state ? null : state)
        },
        [h('span', { class: 'dot', 'aria-hidden': 'true' }), `${number(count)} ${STATE_LABEL[state]}`]
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
        'aria-valuetext': t("Completed tasks: {p0}/{p1}", { p0: tasks.done, p1: tasks.total })
      },
      [fill]
    ),
    h('span', { class: 'count', 'aria-hidden': 'true' }, [`${number(tasks.done)}/${number(tasks.total)}`])
  ])
}

function stepper(change: Change): HTMLElement {
  const marks = steps(change)
  return h(
    'ol',
    { class: 'stepper', 'aria-label': t("Lifecycle") },
    STEPS.map((step) =>
      h('li', { 'data-mark': marks[step] }, [t(step), h('span', { class: 'sr-only' }, [` ${t(marks[step])}`])])
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
    { class: 'actions', role: 'group', 'aria-label': t("Actions for {p0}", { p0: change.name }) },
    actionButtons(change).map((button) =>
      h(
        'button',
        {
          type: 'button',
          class: button.primary ? 'action primary' : 'action secondary',
          disabled: button.disabled || state.starting,
          title: button.reason ?? (button.primary ? step.label : button.label),
          'aria-label': `${button.primary ? step.label : button.label} ${change.name}`,
          'aria-expanded': String(state.pending?.change === change.name && state.pending.action === button.action),
          'data-focus': `run:${button.action}:${itemKey(change)}`,
          onclick: () => actions.run(button.action, change.name)
        },
        [icon(ACTION_ICONS[button.action], 14)]
      )
    )
  )
}

/** Compact by default; the summary keeps unresolved/blocking conditions visible. */
function dependencyContext(name: string, warnings: readonly string[], state: PanelState, actions: Actions): HTMLElement | null {
  if (!warnings.length) return null
  const count = (prefix: string) => warnings.filter(w => w.startsWith(prefix)).length
  const pending = count("Depends on:")
  const satisfied = count("Archived dependency")
  const unknown = count("Unknown dependency:")
  const orderWarnings = warnings.filter(w => /manual order/i.test(w)).length
  const cycle = warnings.some(w => /cycle/i.test(w))
  const summary = [t("Dependencies"), ...(pending ? [new Intl.PluralRules(uiLocale()).select(pending) === 'one' ? t('{p0} pending dependency', { p0: pending }) : t('{p0} pending', { p0: pending })] : []),
    ...(satisfied ? [new Intl.PluralRules(uiLocale()).select(satisfied) === 'one' ? t('{p0} satisfied dependency', { p0: satisfied }) : t('{p0} satisfied', { p0: satisfied })] : []), ...(unknown ? [new Intl.PluralRules(uiLocale()).select(unknown) === 'one' ? t('{p0} unknown dependency', { p0: unknown }) : t('{p0} unknown', { p0: unknown })] : []),
    ...(cycle ? [t("Cycle — no valid sequence")] : []), ...(orderWarnings ? [t("Manual order warning")] : [])].join(' · ')
  const key = `dependencies:${name}`
  const open = state.folded.has(`${key}:open`)
  const details = h('details', { class: 'dependency-context', open }, [
    h('summary', { 'data-focus': key }, [summary]),
    h('ul', {}, warnings.map(text => h('li', {}, [ownOrderingDiagnostic(text)])))
  ]) as HTMLDetailsElement
  details.addEventListener('toggle', () => {
    if (details.open !== open) actions.setFolded(key, !details.open)
  })
  return details
}

/** `archived` makes the card read-only: a muted stripe, an `Archived <date>` pill, no actions. */
export type CardOptions = { warnings?: string[]; asHeading?: boolean; archived?: { date: string | null } }

/** The card of one change; in the detail view its name is the heading instead of a link. */
export function card(change: Change, state: PanelState, actions: Actions, { asHeading = false, archived, warnings }: CardOptions = {}): HTMLElement {
  const readOnly = change.readOnly || state.readOnly || foreign(change, state)
  const current = archived ? 'archived' : changeState(change)
  const pill = archived ? (archived.date ? t("Archived {p0}", { p0: formatDate(archived.date) }) : t("Archived")) : STATE_LABEL[changeState(change)]
  const name: Child = asHeading
    ? h('h2', { class: 'card-name' }, [change.name])
    : h('button', { type: 'button', class: 'card-name', 'data-focus': `change:${itemKey(change)}`, title: t("Open {p0}", { p0: change.name }), onclick: () => actions.select(change.name, change.origin?.workspaceId) }, [
        change.name
      ])
  const deliveryWorkspace = change.origin?.workspaceId ?? ('workspaceId' in change ? String(change.workspaceId) : state.browse?.focusedWorkspaceId)
  const snapshot = deliveryWorkspace ? state.delivery?.[deliveryWorkspace] : undefined
  const deliveryInfo = snapshot?.changes[change.name]
  return h('article', { class: `card state-${current}`, 'aria-label': change.name, ...(!archived ? { 'data-delivery-change': change.name, 'data-delivery-workspace': deliveryWorkspace } : {}) }, [
    h('div', { class: 'card-head' }, [name, h('span', { class: 'pill' }, [pill])]),
    originLabel(change.origin),
    change.tasks && change.tasks.total > 0 ? progressBar(t('Progress: {p0}', { p0: change.name }), change.tasks) : null,
    stepper(change),
    !archived && (snapshot?.configured || deliveryInfo?.ticket) ? deliveryCard(change, deliveryInfo) : null,
    change.missingArtifacts?.length ? h('p', { class: 'message', role: 'status' }, [t("Missing required artifacts: {p0}", { p0: change.missingArtifacts.join(', ') })]) : null,
    !archived && !readOnly && state.list?.status === 'ok'
      ? dependencyContext(change.name, warnings ?? dependencyOrder(state.list.changes).warnings[change.name] ?? [], state, actions) : null,
    h('div', { class: 'card-foot' }, [
      h('span', { class: 'age', 'data-updated': change.updatedAt }, [t('Edited {p0}', { p0: relativeAge(change.updatedAt, Date.now()) })]),
      archived || readOnly ? null : h('button', { type: 'button', class: 'secondary favorite',
        'data-focus': `favorite:${change.name}`, 'aria-label': t("Favorite {p0}", { p0: change.name }),
        'aria-pressed': String(state.ordering.favorites.includes(change.name)),
        onclick: () => actions.toggleFavorite(change.name) }, [state.ordering.favorites.includes(change.name) ? '★' : '☆']),
      archived || readOnly ? null : actionRow(change, state, actions)
    ]),
    !archived && !readOnly && state.pending?.change === change.name && !state.pending.task ? composer(state, actions) : null
  ])
}

/** Keeps the `edited … ago` texts current without redrawing. */
export function refreshAges(root: ParentNode): void {
  const now = Date.now()
  for (const el of root.querySelectorAll<HTMLElement>('.age[data-updated]')) {
    el.textContent = t('Edited {p0}', { p0: relativeAge(Number(el.dataset.updated), now) })
  }
}

const tabLabels = (): Record<Tab, string> => ({ active: t("Active"), archive: t("Archive"), specs: t("Specs"), stores: t("Stores"), spend: t("Spend") })

/** Active · Archive · Specs with their counts; only for a workspace that has OpenSpec. */
export function tabBar(state: PanelState, actions: Actions): HTMLElement | null {
  const list = state.list
  if (!list || list.status === 'remote' || list.status === 'no-workspace') return null
  const counts: Partial<Record<Tab, number>> = list.status === 'ok' ? { active: list.changes.length, archive: list.archived, specs: list.specs } : {}
  const tabs: Tab[] = list.status === 'ok' ? ['active', 'archive', 'specs', 'stores', 'spend'] : state.stores ? ['active', 'stores'] : []
  if (!tabs.length) return null
  return h(
    'div',
    { class: 'tabs', role: 'tablist', 'aria-label': t("OpenSpec views") },
    tabs.map((tab) =>
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
        [tabLabels()[tab], counts[tab] === undefined ? null : h('span', { class: 'tab-count' }, [number(counts[tab]!)])]
      )
    )
  )
}

const searchLabels = (): Record<ListTab, string> => ({
  active: t("Search changes by name"),
  archive: t("Search archived changes by name"),
  specs: t("Search specs by path or purpose")
})

/** The search box of a tab; `data-focus` keeps focus and caret while the list redraws. */
function searchBox(tab: ListTab, state: PanelState, actions: Actions, shown: number, total: number): HTMLElement {
  const query = state.queries[tab]
  return h('div', { class: 'search', role: 'search' }, [
    h('input', {
      type: 'search',
      class: 'search-input',
      'data-focus': `search:${tab}`,
      'aria-label': searchLabels()[tab],
      placeholder: searchLabels()[tab],
      autocomplete: 'off',
      spellcheck: 'false',
      value: query,
      oninput: (event: Event) => actions.setQuery(tab, (event.target as HTMLInputElement).value)
    }),
    query.trim() || (tab === 'active' && state.filter)
      ? h('span', { class: 'search-count muted', role: 'status' }, [t('{p0} of {p1}', { p0: shown, p1: total })])
      : null
  ])
}

/** The rows of the first pages and the Load more control; `noun` names what is counted. */
function pagedList<T>(tab: ListTab, state: PanelState, actions: Actions, items: readonly T[], row: (item: T) => Node, noun: string): Child[] {
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
          [t("Load more ({p0} of {p1} {p2} left)", { p0: Math.min(PAGE_SIZE, remaining), p1: remaining, p2: noun === 'specs' ? new Intl.PluralRules(uiLocale()).select(remaining) === 'one' ? t('specification') : t('specifications') : new Intl.PluralRules(uiLocale()).select(remaining) === 'one' ? t('change') : t('changes') })]
        )
      : null
  ]
}

/** No row matches the search: say so and offer to clear it. */
function noMatches(tab: ListTab, state: PanelState, actions: Actions): HTMLElement {
  const filtered = tab === 'active' && state.filter !== null
  return empty(
    t("No results"),
    state.queries[tab].trim() ? t("Nothing matches “{p0}”.", { p0: state.queries[tab].trim() }) : t("No change has the selected state."),
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
      [filtered ? t("Clear search and filter") : t("Clear search")]
    )
  )
}

function archiveRow(change: ArchivedChange, actions: Actions): HTMLElement {
  const tasks = change.tasks ? `${number(change.tasks.done)}/${number(change.tasks.total)}` : t("no tasks")
  return h('button', { type: 'button', class: 'row', 'data-focus': worktreeItemKey(change.origin?.workspaceId ?? '', 'archive', change.folder), title: t("Open {p0}", { p0: change.name }), onclick: () => actions.openArchived(change.folder, change.origin?.workspaceId) }, [
    h('span', { class: 'row-name' }, [change.name, originLabel(change.origin)]),
    h('span', { class: 'row-meta' }, [change.date ? formatDate(change.date) : '']),
    h('span', { class: 'row-count' }, [tasks])
  ])
}

export function archiveView(state: PanelState, actions: Actions): Child[] {
  if (!state.archive) return [h('p', { class: 'muted message' }, [t("Loading archive…")])]
  if (state.archive.length === 0) {
    return [empty(t("No archived changes"), t("A change moves here when it is archived with /openspec-archive."))]
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
  return h('button', { type: 'button', class: 'row spec-row', title: t("Open {p0}", { p0: spec.capability }), 'data-focus': `spec:${spec.origin?.workspaceId ?? ''}:${spec.capability}`, onclick: () => actions.showSpec(spec.capability, spec.origin?.workspaceId) }, [
    h('span', { class: 'row-name' }, [spec.capability, originLabel(spec.origin)]),
    h('span', { class: 'row-count' }, [plural(spec.requirements, 'requirement')]),
    spec.purpose ? h('span', { class: 'row-purpose muted' }, [spec.purpose]) : null
  ])
}

export function specsView(state: PanelState, actions: Actions): Child[] {
  if (!state.specs) return [h('p', { class: 'muted message' }, [t("Loading specs…")])]
  if (state.specs.length === 0) {
    return [empty(t("No specs yet"), t("Archiving a change creates the specs in openspec/specs/."))]
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
  if (!list) return [h('p', { class: 'muted message' }, [t("Loading changes…")])]
  if (list.status !== 'remote' && list.status !== 'no-workspace') {
    switch (state.tab) {
      case 'stores': return [storeControls(state, actions)]
      case 'spend': return [usageView(state, actions), spendView(state, actions)]
      case 'archive': if (list.status === 'ok') return archiveView(state, actions); break
      case 'specs': if (list.status === 'ok') return specsView(state, actions); break
      case 'active': break
    }
  }
  switch (list.status) {
    case 'no-workspace':
      return [empty(t("No workspace"), t("Open a workspace to see its OpenSpec changes."))]
    case 'remote':
      return [empty(t("Remote workspace"), t("{p0} is on another host; only local workspaces are read.", { p0: list.workspace }))]
    case 'no-openspec':
      return [
        empty(
          t("No OpenSpec here"),
          t("{p0} has no openspec/changes/ folder. Initializing runs `openspec init --tools none`, which only creates openspec/.", { p0: list.workspace }),
          h('button', { type: 'button', class: 'primary', 'data-focus': 'initialize', disabled: state.initializing || (!!state.scope && state.scope !== 'focused'), onclick: () => actions.initialize() }, [
            state.initializing ? t("Initializing…") : t("Initialize OpenSpec")
          ])
        )
      ]
    case 'ok': {
      const groups = new Map<string, Change[]>()
      for (const change of list.changes) {
        const id = change.origin?.workspaceId ?? ''
        const group = groups.get(id) ?? []
        group.push(change)
        groups.set(id, group)
      }
      const byOrigin = new Map([...groups].map(([id, changes]) => [id, dependencyOrder(changes)]))
      const analyses = [...byOrigin.values()]
      const analysis = { ordered: analyses.flatMap(a => a.ordered), unresolved: analyses.flatMap(a => a.unresolved) }
      const matching = new Set(filterActive(list.changes, state.queries.active, state.filter, changeState))
      const source = state.ordering.mode === 'dependencies' ? [...analysis.ordered, ...analysis.unresolved]
        : filterActive(list.changes, '', null, changeState)
      const found = source.filter(c => matching.has(c))
      const favorites = found.filter(c => (!foreign(c, state) && state.ordering.favorites.includes(c.name)))
      const normal = found.filter(c => foreign(c, state) || !state.ordering.favorites.includes(c.name))
      const unresolved = new Set(analysis.unresolved)
      const grouped = [...favorites, ...normal]
      const rows = (change: Change): Node => {
        const heading = state.board ? null : favorites[0] === change ? t("Favorites") : normal[0] === change ? t("Changes") : null
        const cycleHeading = state.ordering.mode === 'dependencies' && unresolved.has(change) &&
          (favorites.filter(c => unresolved.has(c))[0] === change || normal.filter(c => unresolved.has(c))[0] === change)
        return h('div', {}, [heading ? h('h2', { class: 'group-heading' }, [heading]) : null,
          cycleHeading ? h('p', { class: 'dependency-warning', role: 'status' }, [t("Unsequenced — dependency cycle or blocked by one")]) : null,
          card(change, state, actions, { warnings: byOrigin.get(change.origin?.workspaceId ?? '')?.warnings[change.name] ?? [] })])
      }
      const board = state.board ? h('div', { class: 'board-columns', 'aria-label': t("Changes by local state") },
        boardColumns(page(grouped, state.limits.active).shown).map(column => h('section', { class: `board-column state-${column.state}`, 'aria-label': STATE_LABEL[column.state] }, [
          h('h2', { class: 'group-heading' }, [STATE_LABEL[column.state], ` · ${number(found.filter(c => changeState(c) === column.state).length)}`]),
          ...(column.changes.length ? column.changes.map(rows) : [h('p', { class: 'muted message' }, [t("No changes shown")])])
        ]))) : null
      return [
        state.composer ? composer(state, actions) : null,
        list.changes.length === 0 ? null : searchBox('active', state, actions, found.length, list.changes.length),
        strip(list.changes, state.filter, actions),
        h('label', { class: 'ordering-control' }, [t("Order "), h('select', { 'aria-label': t("Change order"), 'data-focus': 'ordering',
          onchange: (event: Event) => actions.setOrdering((event.target as HTMLSelectElement).value === 'dependencies' ? 'dependencies' : 'recent') }, [
          h('option', { value: 'recent', selected: state.ordering.mode === 'recent' }, [t("Recently edited")]),
          h('option', { value: 'dependencies', selected: state.ordering.mode === 'dependencies' }, [t("Dependencies")])
        ])]),
        ...(list.changes.length === 0
          ? [empty(t("No active changes"), t("openspec/changes/ only holds the archive. Press + to propose one."))]
          : found.length === 0
            ? [noMatches('active', state, actions)]
            : board ? [board, ...(page(grouped, state.limits.active).remaining ? [h('button', { type: 'button', class: 'secondary', 'data-focus': 'more:active', onclick: () => actions.loadMore('active') }, [t("Load more changes")])] : [])] : pagedList('active', state, actions, grouped, rows, 'changes')),
        ...(state.board ? [boardArchive(state, actions)] : [])
      ]
    }
  }
}

function boardArchive(state: PanelState, actions: Actions): HTMLElement {
  const open = state.folded.has('board:archive:open')
  const details = h('details', { class: 'board-archive', open }, [
    h('summary', { 'data-focus': 'board:archive' }, [t("Archive · {p0} · Read only", { p0: state.list?.status === 'ok' ? state.list.archived : 0 })]),
    ...(open ? archiveView(state, actions) : [])
  ]) as HTMLDetailsElement
  details.addEventListener('toggle', () => { if (details.open !== open) actions.setFolded('board:archive', !details.open) })
  return details
}
