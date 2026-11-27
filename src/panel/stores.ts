import { t, renderMessage } from '../i18n'
import { h } from './dom'
import type { Actions, PanelState } from './model'

/** Native controls work with keyboard and inherit the host theme. Consent is a separate step. */
export function storeControls(state: PanelState, actions: Actions): HTMLElement | null {
  const info = state.stores
  if (!info) return h('section', { class: 'store-controls', role: 'status' }, [h('h2', {}, [t("Stores")]), state.storesError ?? t("Loading stores…")])
  const root = info.root
  const busy = !!state.storeBusy
  const unavailable = busy || !info.version
  const draft = state.storeDraft ?? { id: '', path: '', prefixes: root?.prefixes.join(', ') ?? '' }
  const preview = state.storePreview
  const control = (label: string, field: 'id' | 'path' | 'prefixes', placeholder: string) => h('label', {}, [label,
    h('input', { type: 'text', value: draft[field], placeholder, 'aria-label': label, 'data-focus': `store-${field}`, disabled: busy,
      oninput: (event: Event) => actions.setStoreDraft(field, (event.target as HTMLInputElement).value) })])
  const button = (label: string, onclick: () => void, disabled = unavailable, focus?: string) => h('button', { type: 'button', class: 'secondary', onclick, disabled, ...(focus ? { 'data-focus': focus } : {}) }, [label])
  const details = h('section', { class: 'store-controls' }, [
    h('h2', {}, [root?.kind === 'store' ? t("OpenSpec stores · {p0} · {p1} · Read only · {p2}", { p0: root.storeId ?? '', p1: root.prefixes.join(', ') || t("All systems"), p2: root.dataPath }) : t("OpenSpec stores")]),
    state.storesLoading ? h('p', { role: 'status' }, [t("Loading stores…")]) : null,
    state.storesError ? h('p', { class: 'message error', role: 'alert' }, [t('Store operation failed.'), ' ', state.storesError]) : null,
    h('p', { class: 'muted' }, [root ? t("Workspace: {p0}", { p0: root.workspacePath }) : t("Data root unavailable. Resolve the diagnostic below.")]),
    root ? h('p', {}, [t("Data: {p0} · {p1}", { p0: root.dataPath, p1: root.kind === 'store' ? t("Store {p0} · {p1} · Read only", {p0: root.storeId ?? "", p1: root.prefixes.join(", ") || t("All systems")}) : t("Local OpenSpec") })]) : null,
    ...(root?.diagnostics.map(text => h('p', { class: 'message error', role: 'status' }, [text])) ?? []),
    info.error ? h('p', { class: 'message error', role: 'status' }, [info.error]) : null,
    preview ? h('section', { class: 'store-preview', 'aria-label': t("Confirm store operation") }, [
      h('h3', { tabindex: '-1', 'data-focus': 'store-preview-heading' }, [t("Review store effects")]),
      h('ul', {}, (preview.messages?.map(renderMessage) ?? preview.effects).map(text => h('li', {}, [text]))),
      button(busy ? t("Saving…") : t("Confirm"), actions.commitStore, busy, 'store-confirm'),
      button(t("Cancel"), actions.cancelStore, busy, 'store-cancel')
    ]) : h('div', { class: 'store-forms' }, [
      h('label', {}, [t("Registered store"), h('select', { 'aria-label': t("Registered store"), 'data-focus': 'store-selection', disabled: unavailable,
        onchange: (event: Event) => actions.setStoreDraft('id', (event.target as HTMLSelectElement).value) }, [
        h('option', { value: '', selected: !draft.id }, [t("Select a store…")]),
        ...info.stores.map(store => h('option', { value: store.id, selected: draft.id === store.id }, [`${store.id} · ${store.root}`]))
      ])]),
      info.stores.length === 0 ? h('p', { class: 'muted' }, [t("No registered stores. Create one below or register it with the OpenSpec CLI.")]) : null,
      h('div', { class: 'store-buttons' }, [
        button(t("Preview link"), () => actions.previewStore({ action: 'link', id: draft.id })),
        button(t("Preview unlink"), () => actions.previewStore({ action: 'unlink' }))
      ]),
      h('h3', {}, [t("Create a local store")]),
      control(t("Store ID"), 'id', 'shared-specs'), control(t("New folder (absolute path)"), 'path', '/path/to/new-store'),
      button(t("Preview creation"), () => actions.previewStore({ action: 'create', id: draft.id, path: draft.path })),
      root?.kind === 'store' ? h('div', {}, [
        control(t("System prefixes (comma separated)"), 'prefixes', 'billing-, identity/'),
        h('p', { class: 'muted' }, [t("Match change names and spec capability paths literally. Empty shows all systems. Saved for this workspace and data root.")]),
        button(t("Save scope"), actions.saveStoreScope)
      ]) : null
    ])
  ])
  return details
}
