import { t } from '../i18n'
// The detail of one change: its card, its files and its task sections.
import type { ChangeDetail, Task, TaskContext, TaskSection, TaskSelection } from '../protocol'
import { h, icon, ICONS, type Child } from './dom'
import type { Actions, PanelState } from './model'
import { relationList } from './relations'
import { markdownView } from './markdown'
import { composer } from './launch'
import { codeSegments, summarize } from './text'
import { card, progressBar } from './views'

/** Text with its `inline code` spans as <code>. */
function richText(text: string): Child[] {
  return codeSegments(text).map((segment) => (segment.code ? h('code', {}, [segment.text]) : segment.text))
}

function files(change: ChangeDetail, open: (file: string) => void, preview: (file: string) => void): HTMLElement {
  const artifacts = change.artifacts.filter((artifact) => artifact !== 'specs/')
  return h('section', { 'aria-label': t("Artifacts") }, [
    h('h3', { class: 'group-title' }, [t("Artifacts")]),
    h('ul', { class: 'files' }, [
      ...[...artifacts, ...change.specs].map(file => h('li', { class: 'artifact-row' }, [
        h('button', { type: 'button', 'data-focus': `preview:${file}`, title: t("Preview {p0}", { p0: file }), onclick: () => preview(file) }, [icon(ICONS.file, 14), file]),
        h('button', { type: 'button', class: 'ghost', 'data-focus': `editor:${file}`, disabled: !!change.readOnly, title: change.readOnly ? t("Open the registered store separately to edit files.") : '', onclick: () => open(file) }, [t("Open in editor")])
      ]))
    ])
  ])
}

// Read-only: editing tasks is out of scope, the mark only shows the state.
function taskRow(task: Task, key: string, state: PanelState, actions: Actions, run?: () => void): HTMLElement {
  const { summary, truncated } = summarize(task.text)
  const open = state.expanded.has(key)
  return h('li', { class: task.done ? 'task done' : 'task' }, [
    h('span', { class: 'mark', 'aria-hidden': 'true' }, [icon(task.done ? ICONS.boxChecked : ICONS.box, 14)]),
    h('div', {}, [
      h('span', { class: 'sr-only' }, [task.done ? t("Done: ") : t("To do: ")]),
      h('span', { class: 'text' }, richText(open ? task.text : summary)),
      run ? h('button', { type: 'button', class: 'ghost task-run', 'data-focus': `run:${key}`, 'aria-label': t("Run task: {p0}", { p0: task.text }), disabled: state.starting, onclick: run }, [t("Run task")]) : null,
      truncated
        ? h('div', {}, [
            h('button', { type: 'button', class: 'ghost', 'data-focus': `expand:${key}`, 'aria-expanded': String(open), onclick: () => actions.toggleExpanded(key) }, [
              open ? t("Show less") : t("Show more")
            ])
          ])
        : null
    ])
  ])
}

function section(change: ChangeDetail, item: TaskSection, index: number, state: PanelState, actions: Actions): HTMLElement {
  const key = `${state.originId ?? change.workspaceId ?? ''}:${change.name}:${index}`
  const done = item.tasks.filter((task) => task.done).length
  const title = item.title || t("Tasks")
  // Folded by default once complete, unless the person opened it.
  const folded = state.folded.has(key) || (done === item.tasks.length && !state.folded.has(`${key}:open`))
  const canRun = !state.readOnly && !state.archivedFolder && state.list?.status === 'ok' && !!change.workspaceId && !!change.tasksFingerprint
  const details = h('details', { class: `section ${done === item.tasks.length ? 'state-done' : 'state-in-progress'}`, open: !folded }, [
    h('summary', { 'data-focus': `task-section:${key}` }, [h('span', {}, [title]), progressBar(t('Progress: {p0}', { p0: title }), { done, total: item.tasks.length })]),
    h('ul', { class: 'tasks' }, item.tasks.map((task, i) => taskRow(task, `${key}:${i}`, state, actions, canRun && !task.done ? () => {
      const selection: TaskSelection & TaskContext = { section: index, position: i, fingerprint: change.tasksFingerprint!, sectionTitle: item.title, text: task.text }
      actions.runTask(change.name, selection, change.workspaceId!)
    } : undefined)))
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
    h('button', { type: 'button', class: 'ghost', 'data-focus': 'back', onclick: () => state.history.length ? actions.back() : (archivedFolder ? actions.openArchived(null) : actions.select(null)) }, [
      icon(ICONS.back, 14),
      state.history.length ? t("Back") : archivedFolder ? t("Archive") : t("All changes")
    ])
  ])
  if (!change) return [back, h('p', { class: 'muted message' }, [state.error ? t("Change unavailable. Use Refresh to retry.") : t("Loading change…")])]
  const archived = archivedFolder && state.archivedDetail ? { date: state.archivedDetail.date } : undefined
  const open = (file: string): void =>
    archivedFolder ? actions.openArchivedFile(archivedFolder, file) : actions.openFile(change.name, file)
  return [
    back,
    state.composer || state.pending?.task ? composer(state, actions) : null,
    h('div', { class: 'detail' }, [
      card(change, state, actions, { asHeading: true, archived }),
      change.resume ? h('section', { 'aria-label': t("Continuation") }, [h('h3', { class: 'group-title' }, [t("Continuation")]), h('p', { class: 'message workflow-resume' }, [change.resume])]) : null,
      files(change, open, actions.previewFile),
      state.preview ? h('section', { class: 'artifact-preview', 'aria-label': t("Preview {p0}", { p0: state.preview.file }) }, [
        h('div', { class: 'preview-toolbar' }, [h('h3', { tabindex: '-1', 'data-focus': 'preview-heading' }, [state.preview.file]),
          h('button', { type: 'button', class: 'secondary', disabled: !!change.readOnly, onclick: () => open(state.preview!.file) }, [t("Open in editor")]),
          h('button', { type: 'button', class: 'ghost', onclick: actions.closePreview }, [t("Close preview")])]),
        state.preview.error ? h('p', { role: 'alert', class: 'message error' }, [state.preview.error])
          : state.preview.markdown === null ? h('p', { role: 'status' }, [t("Loading artifact…")]) : markdownView(state.preview.markdown)
      ]) : null,
      relationList(t("Related changes"), change.related ?? [], state, actions),
      change.sections.length === 0
        ? h('p', { class: 'muted message' }, [t("No tasks in tasks.md.")])
        : h('section', { 'aria-label': t("Tasks") }, [
            h('h3', { class: 'group-title' }, [t("Tasks")]),
            ...change.sections.map((item, index) => section(change, item, index, state, actions))
          ])
    ])
  ]
}
