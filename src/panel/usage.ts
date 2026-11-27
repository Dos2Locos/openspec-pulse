import { formatDate } from './text'
import { t, money, uiLocale, groupLabel } from '../i18n'
import type { SpendTotal } from '../spend'
import { h } from './dom'
import type { Actions, PanelState } from './model'
const usd = (n: number) => money(n, 4)
const price = (total: SpendTotal) => total.knownCosts ? '~' + usd(total.costUsd) + (total.unknownCosts ? " · " + t("No pricing entries: {p0}", { p0: total.unknownCosts }) : '') : total.events ? t("Sin tarifa para este modelo") : t("Sin sesiones locales")
export function usageView(state: PanelState, actions: Actions): HTMLElement | null {
  if (state.list?.status !== 'ok') return null
  const usage = state.usage, spend = usage?.spend, total = spend?.total
  const group = state.usageGroup ?? 'byModel', limit = state.usageLimit ?? 20
  const entries = spend ? Object.entries(spend[group]).sort(([a], [b]) => a.localeCompare(b)) : []
  return h('section', { class: 'spend automatic-usage' }, [
    h('h2', {}, [t("Consumo Claude y Codex · "), total ? price(total) : state.usageError ? t("Error de lectura") : t("Leyendo consumo…")]),
    h('p', { class: 'muted' }, [t("Historial local del workspace seleccionado · coste API estimado. No es un cargo real de tu suscripción. No se atribuye a tareas ni a prefijos del store.")]),
    state.usageLoading ? h('p', { role: 'status' }, [usage ? t("Actualizando; se muestran los datos anteriores.") : t("Buscando sesiones locales…")]) : null,
    usage && state.usageError ? h('p', { role: 'status', class: 'muted' }, [t("Datos anteriores: actualización pendiente. Usa Refresh para reintentar.")]) : null,
    state.usageError ? h('p', { role: 'alert', class: 'error' }, [state.usageError, t(" · Usa Refresh para reintentar.")]) : null,
    total ? h('p', { class: 'spend-total' }, [
      h('strong', {}, [price(total)]),
      h('span', {}, [t("{p0} tokens entrada · {p1} tokens salida", { p0: total.inputTokens.toLocaleString(uiLocale()), p1: total.outputTokens.toLocaleString(uiLocale()) })]),
      h('span', { class: 'muted' }, [t("Entrada incluye {p0} de caché leída y {p1} de caché escrita. Razonamiento ya incluido en salida.", { p0: usage!.cacheReadTokens.toLocaleString(uiLocale()), p1: usage!.cacheWriteTokens.toLocaleString(uiLocale()) })])
    ]) : null,
    total?.events === 0 && !state.usageLoading ? h('p', {}, [t("No se encontraron metadatos de consumo para este workspace. No necesitas generar registros ni configurar pulse.json.")]) : null,
    spend && total?.events ? h('div', {}, [
      h('label', { for: 'usage-group' }, [t("Agrupar consumo ")]),
      h('select', { id: 'usage-group', 'data-focus': 'usage-group', onchange: (event: Event) => actions.setUsageGroup((event.target as HTMLSelectElement).value as typeof group) }, [
        ...(['byTask', 'byModel', 'byMonth'] as const).map((value, index) => h('option', { value, selected: group === value }, [[t("Agente"), t("Modelo"), t("Mes")][index]]))
      ]),
      h('div', { class: 'spend-groups' }, [h('table', {}, [
        h('caption', {}, [group === 'byTask' ? t("Por agente") : group === 'byModel' ? t("Por modelo") : t("Por mes (UTC)")]),
        h('thead', {}, [h('tr', {}, [t("Grupo"), t("API estimada USD"), t("Tokens entrada / salida")].map(label => h('th', { scope: 'col' }, [label])))]),
        h('tbody', {}, entries.slice(0, limit).map(([name, value]) => h('tr', {}, [
          h('th', { scope: 'row' }, [groupLabel(name, group, spend?.literalGroups?.[group]?.includes(name))]), h('td', {}, [price(value)]), h('td', {}, [`${value.inputTokens.toLocaleString(uiLocale())} / ${value.outputTokens.toLocaleString(uiLocale())}`])
        ])))
      ])]),
      entries.length > limit ? h('button', { class: 'secondary', 'data-focus': 'usage-more', onclick: () => actions.moreUsage() }, [t("Mostrar más consumo")]) : null
    ]) : null,
    usage ? h('div', { class: 'muted' }, [
      h('p', {}, [t("Workspace files: {p0}; truncated: {p1}; discarded records: {p2}.", { p0: usage.files, p1: usage.truncated, p2: usage.discarded })]),
      h('p', {}, [t("Tarifas API de referencia: {p0}. Entrada, caché y salida se calculan por separado. Sin cargos de herramientas ni descuentos particulares. Tarifas históricas pueden diferir.", { p0: formatDate(usage.priceDate) })]),
      ...usage.priceSources.map((source, i) => h('a', { href: source, target: '_blank', rel: 'noopener noreferrer' }, [i ? t(" · Precios OpenAI") : t("Precios Anthropic")])),
      ...usage.warnings.map(warning => h('p', {}, [warning]))
    ]) : null
  ])
}
