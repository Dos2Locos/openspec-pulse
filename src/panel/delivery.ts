import { t, uiLocale } from '../i18n'
import { deliveryStatus, type DeliveryInfo } from '../delivery'
import type { Change } from '../protocol'
import { h } from './dom'
import type { Actions, PanelState } from './model'

export function deliveryCard(change: Change, info?: DeliveryInfo): HTMLElement | null {
  if (!info) return null
  return h('section', { class: 'delivery', 'aria-label': t("GitHub delivery") }, [
    h('div', { class: 'delivery-heading' }, [
      info.ticket ? h('a', { href: info.ticket.url, target: '_blank', rel: 'noopener noreferrer', 'aria-label': t("Open ticket {p0}", { p0: info.ticket.id }) }, [info.ticket.id]) : null,
      h('span', { class: `delivery-state delivery-${info.freshness}` }, [deliveryStatus(info, change.tasks)]),
      info.freshness === 'stale' ? h('strong', {}, [t("Stale")]) : null
    ]),
    info.checkedAt !== null ? h('p', { class: 'muted' }, [t("Last checked: {p0}", { p0: new Date(info.checkedAt).toLocaleString(uiLocale()) })]) : null,
    info.error ? h('p', { class: 'muted' }, [info.error]) : null,
    ...info.prs.map(pr => h('p', {}, [
      h('a', { href: pr.url, target: '_blank', rel: 'noopener noreferrer', title: pr.reason, 'aria-label': t("Open PR #{p0}: {p1}", { p0: String(pr.number), p1: pr.title }) }, [`#${pr.number} · ${pr.title}`]),
      h('span', { class: 'muted' }, [` · ${pr.state === 'OPEN' ? t('In review') : pr.state === 'MERGED' ? t('Merged') : t('Closed without merge')} · ${pr.reason}`])
    ]))
  ])
}

export function githubPreferences(state: PanelState, actions: Actions): HTMLElement | null {
  const id = state.browse?.focusedWorkspaceId
  const snapshot = id ? state.delivery?.[id] : undefined
  if (!snapshot?.configured) return null
  return h('details', { class: 'github-preferences', open: state.githubPreferencesOpen,
    ontoggle: (event: Event) => actions.setGithubPreferencesOpen((event.target as HTMLDetailsElement).open) }, [
    h('summary', { 'data-focus': 'github-preferences' }, [t("GitHub account · {p0}", { p0: snapshot.login ?? t("Choose login") })]),
    h('p', { class: 'muted' }, [t("Expected login for this project. Credentials stay in GitHub CLI; no token is stored in pulse.json.")]),
    snapshot.requiredLogin ? h('p', {}, [t("Required for this project: {p0}", { p0: snapshot.requiredLogin })]) : null,
    h('form', { onsubmit: (event: Event) => {
      event.preventDefault()
      const data = new FormData(event.target as HTMLFormElement)
      actions.saveGithubLogin(String(data.get('github-login') ?? '').trim() || null)
    } }, [
      h('label', { for: 'github-login' }, [t("Expected GitHub login")]),
      h('input', { id: 'github-login', name: 'github-login', type: 'text', autocomplete: 'off', spellcheck: 'false',
        'data-focus': 'github-login', value: state.githubLoginDraft ?? snapshot.login ?? '', maxlength: 39,
        oninput: (event: Event) => actions.setGithubLoginDraft((event.target as HTMLInputElement).value) }),
      h('button', { type: 'submit', class: 'secondary', disabled: state.deliverySaving, 'data-focus': 'github-save' }, [state.deliverySaving ? t("Saving…") : t("Save account")])
    ]),
    h('p', { class: 'muted' }, [t("Clear the login to disable queries. Read-only results refresh after 5 minutes; failures retry after 60 seconds.")])
  ])
}
