import { t, money, uiLocale, groupLabel } from '../i18n'
import type { SpendSnapshot, SpendTotal } from '../spend'
import { h } from './dom'
import type { Actions, PanelState } from './model'

export function spendCost(total: SpendTotal): string {
  const cost = total.knownCosts ? money(total.costUsd) : t("Coste desconocido")
  return cost + (total.unknownCosts ? " · " + t("Review entries without a declared cost: {p0}.", { p0: total.unknownCosts }) : '')
}
function totals(total: SpendTotal): HTMLElement {
  return h('p', { class: 'spend-total' }, [
    h('strong', {}, [spendCost(total)]),
    h('span', { class: 'muted' }, [t("Recorded events: {p0}. Input tokens: {p1}. Output tokens: {p2}.", { p0: total.events, p1: total.inputTokens.toLocaleString(uiLocale()), p2: total.outputTokens.toLocaleString(uiLocale()) })])
  ])
}
function coverage(snapshot: SpendSnapshot): HTMLElement {
  const d = snapshot.diagnostics
  return h('div', { class: 'muted spend-coverage' }, [
    h('p', {}, [t("Files: {p0}; truncated: {p1}; discarded lines: {p2}; excluded paths: {p3}; duplicate IDs: {p4}; conflicts: {p5}.", { p0: d.files, p1: d.truncated, p2: d.discarded, p3: d.excluded, p4: d.duplicates, p5: d.conflicts })]),
    d.conflicts ? h('p', { role: 'status' }, [t("IDs con contenido divergente: se conserva el primer evento; no se suman sus copias.")]) : null,
    d.withoutId ? h('p', {}, [t("Events without ID: {p0}. Cross-file deduplication is not guaranteed.", { p0: d.withoutId })]) : null,
    ...snapshot.warnings.map(warning => h('p', {}, [warning]))
  ])
}
function groups(snapshot: SpendSnapshot, group: 'byTask' | 'byModel' | 'byMonth', limit: number): HTMLElement {
  const entries = Object.entries(snapshot[group]).sort(([a], [b]) => a.localeCompare(b))
  return h('div', { class: 'spend-groups' }, [
    h('table', {}, [
      h('caption', {}, [group === 'byTask' ? t("Por tarea") : group === 'byModel' ? t("Por modelo") : t("Por mes (UTC)")]),
      h('thead', {}, [h('tr', {}, [t("Grupo"), t("USD declarado"), t("Tokens entrada / salida")].map(label => h('th', { scope: 'col' }, [label])))]),
      h('tbody', {}, entries.slice(0, limit).map(([name, total]) => h('tr', {}, [
        h('th', { scope: 'row' }, [groupLabel(name, group, snapshot.literalGroups?.[group]?.includes(name))]),
        h('td', {}, [spendCost(total)]),
        h('td', {}, [`${total.inputTokens.toLocaleString(uiLocale())} / ${total.outputTokens.toLocaleString(uiLocale())}`])
      ])))
    ]),
    entries.length > limit ? h('p', { class: 'muted' }, [t("Mostrando {p0} de {p1} grupos.", { p0: limit, p1: entries.length })]) : null
  ])
}
export function spendView(state: PanelState, actions: Actions): HTMLElement | null {
  const snapshot = state.browse?.spend
  if (!snapshot?.enabled) return h('section', { class: 'spend' }, [h('h2', {}, [t("Recorded spend")]), h('p', { role: 'status' }, [snapshot ? t("Project run records are disabled.") : t("Project run records are unavailable. Automatic usage is shown separately.")])])
  const group = state.spendGroup ?? 'byTask', limit = state.spendLimit ?? 20
  const unassigned = snapshot.unattributed
  const more = Object.keys(snapshot[group]).length > limit || !!unassigned && Object.keys(unassigned[group]).length > limit
  return h('section', { class: 'spend' }, [
    h('h2', {}, [t("Gasto registrado · "), spendCost(snapshot.total)]),
    h('p', { class: 'muted' }, [t("Ámbito seleccionado · cambios activos y archivados. Solo registros aportados por el proyecto; no es el coste total real ni una factura.")]),
    state.spendStale ? h('p', { role: 'status', class: 'muted' }, [t("Datos anteriores: actualización pendiente. Usa Refresh para reintentar.")]) : null,
    totals(snapshot.total),
    snapshot.total.events === 0 ? h('p', {}, [t("Sin registros válidos en el ámbito seleccionado.")]) : null,
    h('label', { for: 'spend-group' }, [t("Agrupar gasto ")]),
    h('select', { id: 'spend-group', 'data-focus': 'spend-group',
      onchange: (event: Event) => actions.setSpendGroup((event.target as HTMLSelectElement).value as typeof group) }, [
      ...(['byTask', 'byModel', 'byMonth'] as const).map((value, index) => h('option', { value, selected: group === value }, [[t("Tarea"), t("Modelo"), t("Mes")][index]]))
    ]),
    groups(snapshot, group, limit),
    coverage(snapshot),
    unassigned ? h('section', { 'aria-label': t("Sin atribuir") }, [
      h('h3', {}, [t("Sin atribuir")]), h('p', { class: 'muted' }, [t("Registros de carpetas adicionales de la raíz. Fuera del total filtrado; sin asociación a un cambio.")]),
      totals(unassigned.total), groups(unassigned, group, limit), coverage(unassigned)
    ]) : null,
    more ? h('button', { class: 'secondary', 'data-focus': 'spend-more', onclick: () => actions.moreSpend() }, [t("Mostrar más grupos")]) : null
  ])
}
