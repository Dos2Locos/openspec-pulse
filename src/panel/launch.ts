import { t } from '../i18n'
// The command sheet: agent, model, destination and the exact command, shown before anything is sent.
import { buildPrompt, profileLabel } from '../commands'
import type { AgentAction, ProfileInfo, SessionInfo } from '../protocol'
import { h } from './dom'
import { activeLaunch, archiveDestination, type Actions, type FreeAction, type PanelState } from './model'

const forms = (): Record<FreeAction, { title: string; label: string; placeholder: string }> => ({
  propose: { title: t("New proposal"), label: t("What do you want to change?"), placeholder: t("Add a CSV export to the monthly report…") },
  explore: {
    title: t("Explore"),
    label: t("What do you want to think through? (optional)"),
    placeholder: t("How should we cache the API answers?")
  }
})

const SESSION = 'session:'
const sessionLabel = (s: SessionInfo): string =>
  `${s.title || s.terminalId} · ${s.agent === 'claude' ? 'Claude Code' : s.agent === 'codex' ? 'Codex' : s.agent} · ${s.available ? t('idle') : t('Session status: {p0}', {p0: s.state})}`

function select(id: string, label: string, value: string, options: { value: string; text: string; disabled?: boolean }[], onchange: (v: string) => void): HTMLElement {
  const el = h('select', { id, 'data-focus': id, onchange: (event) => onchange((event.target as HTMLSelectElement).value) },
    options.map((o) => h('option', { value: o.value, disabled: o.disabled === true }, [o.text]))) as HTMLSelectElement
  el.value = value
  return h('div', { class: 'field' }, [h('label', { for: id }, [label]), el])
}

/** Where the command goes, in words. */
export function destinationText(state: PanelState, profile: ProfileInfo): string {
  if (state.target === 'new') return t('a new {p0} session', { p0: profileLabel(profile) })
  if (state.target.startsWith(SESSION)) {
    const session = state.agent?.sessions.find((s) => s.terminalId === state.target.slice(SESSION.length))
    return session ? t('session {p0}', { p0: session.title || session.terminalId }) : t("a session that is gone")
  }
  return t("the idle {p0} session that has waited longest, else a new session", { p0: profile.agent === 'claude' ? 'Claude Code' : 'Codex' })
}

export function composer(state: PanelState, actions: Actions): HTMLElement | null {
  const launch = activeLaunch(state)
  if (!launch) return null
  const free = state.composer
  const form = free ? forms()[free] : null
  const title = launch.action === 'task' ? t("Run task · {p0}", { p0: launch.change ?? '' }) : form?.title ?? `${({continue:t('Continue'), apply:t('Apply'), verify:t('Verify'), archive:t('Archive'), propose:t('New proposal'), explore:t('Explore'),task:t('Run task')})[launch.action]} ${launch.change ?? ''}`.trim()
  const options = state.agent
  const profile = options?.profiles.find((p) => p.id === state.profile)
  const built = buildPrompt(state.profile, launch.action as AgentAction, { change: launch.change, prompt: state.draft, task: launch.task }, options?.workflow?.config)
  // An empty `propose` draft is the only error the person has not caused by a typo: say nothing yet.
  const preview = 'prompt' in built ? built.prompt : null
  const sessionTarget = state.target.startsWith(SESSION)
  const fingerprint = options?.workflow?.fingerprint
  const custom = !!options?.workflow?.config?.commands?.[launch.action]
  const accepted = !custom || (!!preview && (options?.approvedCommands?.includes(preview) ||
    (state.workflowConsent?.fingerprint === fingerprint && state.workflowConsent?.command === preview)))
  const canStart = accepted && !state.starting && !!options && !!profile && preview !== null && (!form || launch.action === 'explore' || state.draft.trim() !== '')

  const parts: (HTMLElement | null)[] = [h('h2', { tabindex: '-1', 'data-focus': 'launch-heading' }, [title])]
  if (launch.action === 'archive') {
    const change = state.detail?.name === launch.change ? state.detail : state.list?.status === 'ok' ? state.list.changes.find(c => c.name === launch.change) : null
    const pending = change?.tasks ? change.tasks.total - change.tasks.done : null
    parts.push(h('p', { class: 'message', role: 'status' }, [
      t("Workspace: {p0} ({p1}). ", { p0: state.browse?.worktrees.find(w => w.workspaceId === options?.workspaceId)?.name ?? (state.list && 'workspace' in state.list ? state.list.workspace : options?.workspaceId ?? t('unavailable')), p1: options?.workspaceId ?? t('loading') }),
      t("Archive destination: {p0}. ", { p0: archiveDestination(launch.change!) }),
      pending === null ? t("Task count unavailable; review before archiving. ") : pending > 0 ? t("Unfinished tasks: {p0}. ", { p0: pending }) : t("All tracked tasks are complete. "),
      t("This sends only the archive command below. Cancel sends nothing.")
    ]))
  }
  if (options?.workflow?.config) parts.push(h('p', { class: 'hint message' }, [
    t("Project workflow · Required artifacts: {p0}. Continuation prefixes: {p1}.", { p0: options.workflow.config.requiredArtifacts?.join(', ') ?? t("default task rules"), p1: options.workflow.config.resumePrefixes?.join(', ') || t('none') })
  ]))
  if (options?.workflow?.error) parts.push(h('p', { class: 'hint message', role: 'status' }, [options.workflow.error, t(" Using agent profile defaults.")]))
  if (launch.task) parts.push(h('p', { class: 'hint message' }, [t("Progress updates only when tasks.md changes.")]))
  if (form) {
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
        } else if (key.key === 'Escape') { key.preventDefault(); key.stopPropagation(); actions.closeComposer() }
      }
    }) as HTMLTextAreaElement
    textarea.value = state.draft
    parts.push(h('label', { for: 'composer-text' }, [form.label]), textarea)
  }
  if (!options || !profile) {
    parts.push(h('p', { class: 'hint message' }, [options ? t("No tested agent profile is available.") : t("Reading the workspace’s agents…")]))
  } else {
    parts.push(
      select('agent-profile', t("Agent"), state.profile, options.profiles.map((p) => ({ value: p.id, text: profileLabel(p) })), (v) => actions.setProfile(v as typeof state.profile)),
      select(
        'agent-target',
        t("Send to"),
        state.target,
        [
          { value: 'auto', text: t("Automatic: idle session, else new") },
          { value: 'new', text: t("New session") },
          ...options.sessions
            .filter((s) => s.agent === profile.agent)
            .map((s) => ({ value: `${SESSION}${s.terminalId}`, text: sessionLabel(s), disabled: !s.available }))
        ],
        actions.setTarget
      )
    )
    // Only a profile that can take a model offers the field; an open session keeps its own.
    if (profile.supportsModel) {
      const input = h('input', {
        id: 'agent-model',
        type: 'text',
        'data-focus': 'agent-model',
        placeholder: t("Default"),
        autocomplete: 'off',
        spellcheck: 'false',
        disabled: sessionTarget,
        onchange: (event) => actions.setModel((event.target as HTMLInputElement).value)
      }) as HTMLInputElement
      input.value = sessionTarget ? '' : state.model
      parts.push(
        h('div', { class: 'field' }, [
          h('label', { for: 'agent-model' }, [t("Model (optional)")]),
          input,
          h('span', { class: 'hint message' }, [sessionTarget ? t("An open session keeps its model.") : t("Applies to a new session only.")])
        ])
      )
    }
    parts.push(
      h('div', { class: 'preview', 'aria-label': t("Command to send") }, [
        h('span', { class: 'hint message' }, [`${profileLabel(profile)} → ${destinationText(state, profile)}`]),
        h('code', {}, [preview ?? t("Describe the change to propose.")])
      ])
    )
  }
  if (custom && fingerprint && preview) parts.push(h('label', { class: 'message workflow-consent' }, [
    h('input', { type: 'checkbox', 'data-focus': 'workflow-consent', checked: !!accepted, disabled: state.starting || !!options?.approvedCommands?.includes(preview),
      onchange: event => actions.acceptWorkflow(fingerprint, preview, (event.target as HTMLInputElement).checked) }),
    t(" Accept this project command locally for this workspace and configuration.")
  ]))
  parts.push(
    h('div', { class: 'row-end' }, [
      h('button', { type: 'button', class: 'secondary', 'data-focus': 'launch-cancel', disabled: state.starting, onclick: () => actions.closeComposer() }, [t("Cancel")]),
      h('button', { type: 'button', class: 'primary', 'data-focus': 'launch-send', disabled: !canStart, onclick: () => actions.submit() }, [
        state.starting ? t("Sending…") : form ? t("Start") : t("Send")
      ])
    ])
  )
  return h('section', { class: 'composer', 'aria-label': title, onkeydown: (event) => {
    if ((event as KeyboardEvent).key === 'Escape') { event.preventDefault(); event.stopPropagation(); actions.closeComposer() }
  } }, parts)
}
