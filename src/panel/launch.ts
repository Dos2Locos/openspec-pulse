// The command sheet: agent, model, destination and the exact command, shown before anything is sent.
import { buildPrompt } from '../commands'
import type { AgentAction, ProfileInfo, SessionInfo } from '../protocol'
import { h } from './dom'
import { activeLaunch, type Actions, type FreeAction, type PanelState } from './model'

const FORMS: Record<FreeAction, { title: string; label: string; placeholder: string }> = {
  propose: { title: 'New proposal', label: 'What do you want to change?', placeholder: 'Add a CSV export to the monthly report…' },
  explore: {
    title: 'Explore',
    label: 'What do you want to think through? (optional)',
    placeholder: 'How should we cache the API answers?'
  }
}

const SESSION = 'session:'
const sessionLabel = (s: SessionInfo): string =>
  `${s.title || s.terminalId} · ${s.agent} · ${s.available ? 'idle' : s.state}`

function select(id: string, label: string, value: string, options: { value: string; text: string; disabled?: boolean }[], onchange: (v: string) => void): HTMLElement {
  const el = h('select', { id, 'data-focus': id, onchange: (event) => onchange((event.target as HTMLSelectElement).value) },
    options.map((o) => h('option', { value: o.value, disabled: o.disabled === true }, [o.text]))) as HTMLSelectElement
  el.value = value
  return h('div', { class: 'field' }, [h('label', { for: id }, [label]), el])
}

/** Where the command goes, in words. */
export function destinationText(state: PanelState, profile: ProfileInfo): string {
  if (state.target === 'new') return `a new ${profile.label} session`
  if (state.target.startsWith(SESSION)) {
    const session = state.agent?.sessions.find((s) => s.terminalId === state.target.slice(SESSION.length))
    return session ? `session ${session.title || session.terminalId}` : 'a session that is gone'
  }
  return `the idle ${profile.agent} session that has waited longest, else a new session`
}

export function composer(state: PanelState, actions: Actions): HTMLElement | null {
  const launch = activeLaunch(state)
  if (!launch) return null
  const free = state.composer
  const form = free ? FORMS[free] : null
  const title = form?.title ?? `${launch.action[0].toUpperCase()}${launch.action.slice(1)} ${launch.change ?? ''}`.trim()
  const options = state.agent
  const profile = options?.profiles.find((p) => p.id === state.profile)
  const built = buildPrompt(state.profile, launch.action as AgentAction, { change: launch.change, prompt: state.draft })
  // An empty `propose` draft is the only error the person has not caused by a typo: say nothing yet.
  const preview = 'prompt' in built ? built.prompt : null
  const sessionTarget = state.target.startsWith(SESSION)
  const canStart = !state.starting && !!options && !!profile && preview !== null && (!form || launch.action === 'explore' || state.draft.trim() !== '')

  const parts: (HTMLElement | null)[] = [h('h2', {}, [title])]
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
        } else if (key.key === 'Escape') actions.closeComposer()
      }
    }) as HTMLTextAreaElement
    textarea.value = state.draft
    parts.push(h('label', { for: 'composer-text' }, [form.label]), textarea)
  }
  if (!options || !profile) {
    parts.push(h('p', { class: 'hint message' }, [options ? 'No tested agent profile is available.' : 'Reading the workspace’s agents…']))
  } else {
    parts.push(
      select('agent-profile', 'Agent', state.profile, options.profiles.map((p) => ({ value: p.id, text: p.label })), (v) => actions.setProfile(v as typeof state.profile)),
      select(
        'agent-target',
        'Send to',
        state.target,
        [
          { value: 'auto', text: 'Automatic: idle session, else new' },
          { value: 'new', text: 'New session' },
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
        placeholder: 'Default',
        autocomplete: 'off',
        spellcheck: 'false',
        disabled: sessionTarget,
        onchange: (event) => actions.setModel((event.target as HTMLInputElement).value)
      }) as HTMLInputElement
      input.value = sessionTarget ? '' : state.model
      parts.push(
        h('div', { class: 'field' }, [
          h('label', { for: 'agent-model' }, ['Model (optional)']),
          input,
          h('span', { class: 'hint message' }, [sessionTarget ? 'An open session keeps its model.' : 'Applies to a new session only.'])
        ])
      )
    }
    parts.push(
      h('div', { class: 'preview', 'aria-label': 'Command to send' }, [
        h('span', { class: 'hint message' }, [`${profile.label} → ${destinationText(state, profile)}`]),
        h('code', {}, [preview ?? 'Describe the change to propose.'])
      ])
    )
  }
  parts.push(
    h('div', { class: 'row-end' }, [
      h('button', { type: 'button', class: 'secondary', 'data-focus': 'launch-cancel', onclick: () => actions.closeComposer() }, ['Cancel']),
      h('button', { type: 'button', class: 'primary', 'data-focus': 'launch-send', disabled: !canStart, onclick: () => actions.submit() }, [
        state.starting ? 'Sending…' : form ? 'Start' : 'Send'
      ])
    ])
  )
  return h('section', { class: 'composer', 'aria-label': title }, parts)
}
