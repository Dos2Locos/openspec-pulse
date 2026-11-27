// The detail of one change: its card, its files and its task sections.
import type { ChangeDetail, Task, TaskSection } from '../protocol'
import { h, icon, ICONS, type Child } from './dom'
import type { Actions, PanelState } from './model'
import { composer } from './launch'
import { codeSegments, summarize } from './text'
import { card, progressBar } from './views'

/** Text with its `inline code` spans as <code>. */
function richText(text: string): Child[] {
  return codeSegments(text).map((segment) => (segment.code ? h('code', {}, [segment.text]) : segment.text))
}

function fileRow(label: string, path: string | null, paths: readonly string[], onclick: () => void): HTMLElement {
  return h('li', {}, [
    h('button', { type: 'button', onclick, title: `Open ${path ?? label}` }, [
      icon(paths, 14),
      h('span', { class: 'label' }, [label]),
      path ? h('span', { class: 'path' }, [path]) : null
    ])
  ])
}

function files(change: ChangeDetail, open: (file: string) => void): HTMLElement {
  const artifacts = change.artifacts.filter((artifact) => artifact !== 'specs/')
  return h('section', { 'aria-label': 'Artifacts' }, [
    h('h3', { class: 'group-title' }, ['Artifacts']),
    h('ul', { class: 'files' }, [
      ...artifacts.map((file) => fileRow(file, null, ICONS.file, () => open(file))),
      ...change.specs.map((spec) => fileRow(spec.split('/')[1], spec, ICONS.book, () => open(spec)))
    ])
  ])
}

// Read-only: editing tasks is out of scope, the mark only shows the state.
function taskRow(task: Task, key: string, state: PanelState, actions: Actions): HTMLElement {
  const { summary, truncated } = summarize(task.text)
  const open = state.expanded.has(key)
  return h('li', { class: task.done ? 'task done' : 'task' }, [
    h('span', { class: 'mark', 'aria-hidden': 'true' }, [icon(task.done ? ICONS.boxChecked : ICONS.box, 14)]),
    h('div', {}, [
      h('span', { class: 'sr-only' }, [task.done ? 'Done: ' : 'To do: ']),
      h('span', { class: 'text' }, richText(open ? task.text : summary)),
      truncated
        ? h('div', {}, [
            h('button', { type: 'button', class: 'ghost', 'aria-expanded': String(open), onclick: () => actions.toggleExpanded(key) }, [
              open ? 'Show less' : 'Show more'
            ])
          ])
        : null
    ])
  ])
}

function section(change: string, item: TaskSection, index: number, state: PanelState, actions: Actions): HTMLElement {
  const key = `${change}:${index}`
  const done = item.tasks.filter((task) => task.done).length
  const title = item.title || 'Tasks'
  // Folded by default once complete, unless the person opened it.
  const folded = state.folded.has(key) || (done === item.tasks.length && !state.folded.has(`${key}:open`))
  const details = h('details', { class: `section ${done === item.tasks.length ? 'state-done' : 'state-in-progress'}`, open: !folded }, [
    h('summary', {}, [h('span', {}, [title]), progressBar(`${title} progress`, { done, total: item.tasks.length })]),
    h('ul', { class: 'tasks' }, item.tasks.map((task, i) => taskRow(task, `${key}:${i}`, state, actions)))
  ]) as HTMLDetailsElement
  details.addEventListener('toggle', () => {
    if (details.open === !folded) return
    actions.setFolded(key, !details.open)
  })
  return details
}

/** The active change's detail, or the archived one's (read-only) when a folder is open. */
export function detailView(state: PanelState, actions: Actions): Child[] {
  const archivedFolder = state.archivedFolder
  const change = archivedFolder ? state.archivedDetail : state.detail
  const back = h('div', {}, [
    h('button', { type: 'button', class: 'ghost', 'data-focus': 'back', onclick: () => (archivedFolder ? actions.openArchived(null) : actions.select(null)) }, [
      icon(ICONS.back, 14),
      archivedFolder ? 'Archive' : 'All changes'
    ])
  ])
  if (!change) return [back, h('p', { class: 'muted message' }, ['Loading change…'])]
  const archived = archivedFolder && state.archivedDetail ? { date: state.archivedDetail.date } : undefined
  const open = (file: string): void =>
    archivedFolder ? actions.openArchivedFile(archivedFolder, file) : actions.openFile(change.name, file)
  return [
    back,
    composer(state, actions),
    h('div', { class: 'detail' }, [
      card(change, state, actions, { asHeading: true, archived }),
      files(change, open),
      change.sections.length === 0
        ? h('p', { class: 'muted message' }, ['No tasks in tasks.md.'])
        : h('section', { 'aria-label': 'Tasks' }, [
            h('h3', { class: 'group-title' }, ['Tasks']),
            ...change.sections.map((item, index) => section(change.name, item, index, state, actions))
          ])
    ])
  ]
}
