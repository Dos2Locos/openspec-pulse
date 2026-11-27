import { t, uiLocale } from '../i18n'
import type { ChangeRef } from '../protocol'
import { relationKey } from '../relations'
import { h, icon, ICONS, type Child } from './dom'
import type { Actions, PanelState } from './model'
import { matches, page, PAGE_SIZE } from './search'

export function relationList(title: string, refs: readonly ChangeRef[], state: PanelState, actions: Actions): HTMLElement {
  const found = refs.filter(ref => matches(state.relationQuery, ref.name, ref.source === 'archive' ? ref.folder : t("Active")))
  const { shown, remaining } = page(found, state.relationLimit)
  return h('section', { 'aria-label': title, class: 'relations' }, [
    h('h3', { class: 'group-title' }, [title]),
    h('p', { class: 'muted' }, [t("These changes contain a spec delta; this does not confirm integration.")]),
    refs.length ? h('div', { class: 'search', role: 'search' }, [
      h('input', { type: 'search', class: 'search-input', 'aria-label': t("Search related changes"),
        'data-focus': 'search:relations', placeholder: t("Search related changes"), value: state.relationQuery,
        oninput: (event: Event) => actions.setRelationQuery((event.target as HTMLInputElement).value) }),
      h('span', { class: 'muted', role: 'status' }, [t('{p0} of {p1}', { p0: found.length, p1: refs.length })])
    ]) : null,
    !found.length ? h('p', { class: 'muted', role: 'status' }, [refs.length ? t("No related changes match this search.") : t("No related changes.")]) : null,
    h('div', { class: 'body-list' }, shown.map(ref => h('button', {
      type: 'button', class: 'row', 'data-focus': `relation:${relationKey(ref)}`, onclick: () => actions.showRelated(ref)
    }, [h('span', { class: 'row-name' }, [ref.name]),
      h('span', { class: 'row-meta' }, [ref.source === 'archive' ? t("Archived · {p0}", { p0: ref.folder }) : t("Active")])]))),
    remaining ? h('button', { type: 'button', class: 'secondary load-more', 'data-focus': 'more:relations',
      onclick: () => actions.moreRelations() }, [t("Load more ({p0} of {p1} changes left)", { p0: Math.min(PAGE_SIZE, remaining), p1: remaining })]) : null
  ])
}

export function specDetailView(state: PanelState, actions: Actions): Child[] {
  const spec = state.specDetail
  const back = h('button', { type: 'button', class: 'ghost', 'data-focus': 'back', onclick: () => actions.back() }, [icon(ICONS.back, 14), t("Back")])
  if (!spec) return [back, h('p', { class: 'muted message' }, [state.error ? t("Spec unavailable. Use Refresh to retry.") : t("Loading spec…")])]
  return [back, h('div', { class: 'detail spec-detail' }, [
    h('h2', { class: 'spec-heading' }, [spec.capability]),
    h('p', {}, [spec.purpose ?? t("No purpose documented.")]),
    h('p', { class: 'muted' }, [new Intl.PluralRules(uiLocale()).select(spec.requirements) === 'one' ? t('{p0} requirement', { p0: spec.requirements }) : t('{p0} requirements', { p0: spec.requirements })]),
    h('button', { type: 'button', class: 'secondary', 'data-focus': 'spec:editor', disabled: !!spec.readOnly, title: spec.readOnly ? t("Open the registered store separately to edit files.") : '', onclick: () => actions.openSpec(spec.capability) }, [t("Open in editor")]),
    relationList(t("Changes affecting this spec"), spec.changes, state, actions)
  ])]
}
