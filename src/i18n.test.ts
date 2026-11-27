import { assert, test } from 'orca/testing'
import { catalogs, money, number, parameters, resolveLocale, setLocale, t, translate, validateCatalogs } from './i18n'
import type { MessageKey } from './messages'

test('Orca locale resolution is deterministic; explicit Chinese script takes precedence', () => {
  for (const locale of ['en', 'en-US', 'en-GB']) assert.equal(resolveLocale(locale), 'en')
  for (const locale of ['es', 'es-ES', 'es-MX', 'es-419']) assert.equal(resolveLocale(locale), 'es-ES')
  for (const locale of ['zh', 'zh-Hans', 'zh-CN', 'zh-SG', 'zh-Hans-TW']) assert.equal(resolveLocale(locale), 'zh-Hans')
  for (const locale of [undefined, null, '', ' en', 'es_ES', 'invalid!', 'fr', 'zh-Hant', 'zh-Hant-CN', 'zh-TW', 'zh-HK', 'zh-MO', 4]) assert.equal(resolveLocale(locale), 'en')
})

test('all catalogs have exactly the same keys and interpolation parameters', () => {
  validateCatalogs()
  for (const locale of ['en', 'es-ES', 'zh-Hans'] as const) {
    for (const key of Object.keys(catalogs.en) as MessageKey[]) {
      const params = Object.fromEntries(parameters(catalogs.en[key]).map(p => [p, 'PROJECT/{unchanged}']))
      const rendered = translate(locale, key, params)
      assert.ok(rendered.length > 0)
      if (Object.keys(params).length) assert.ok(rendered.includes('PROJECT/{unchanged}'))
    }
  }
})

test('missing or surplus parameters fail instead of leaking keys or placeholders', () => {
  let failed = 0
  for (const params of [{}, { p0: 'path', extra: 'wrong' }] as Record<string, string>[]) {
    try { translate('en', 'Open {p0}', params) } catch { failed++ }
  }
  assert.equal(failed, 2)
  setLocale('es-ES'); assert.equal(t('Stores'), 'Almacenes')
  setLocale('zh-Hans'); assert.equal(t('Stores'), '存储库')
  setLocale('en'); assert.equal(t('Stores'), 'Stores')
})

test('amounts retain USD and the same value in every UI locale', () => {
  for (const locale of ['en', 'es-ES', 'zh-Hans'] as const) {
    assert.equal(money(1234.56, 6, locale), new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', maximumFractionDigits: 6 }).format(1234.56))
    assert.equal(number(1234567, locale), new Intl.NumberFormat(locale).format(1234567))
  }
})

test('own grouping labels, plurals, ages and previews change locale while project strings stay literal', async () => {
  const { groupLabel, ownOrderingDiagnostic, renderMessage } = await import('./i18n')
  const { relativeAge } = await import('./state')
  for (const locale of ['en', 'es-ES', 'zh-Hans'] as const) {
    setLocale(locale)
    assert.equal(groupLabel('__pulse_no_model__'), translate(locale, 'No model'))
    assert.equal(groupLabel('Sin modelo'), 'Sin modelo')
    assert.equal(groupLabel('Model-{p0}'), 'Model-{p0}')
    assert.equal(ownOrderingDiagnostic('Depends on: add-english-task'), translate(locale, 'Depends on: {p0}', { p0: 'add-english-task' }))
    assert.equal(renderMessage({ key: 'Set store: {p0} in {p1}. Preserve other keys and comments.', params: { p0: 'shared-id', p1: '/project/{unchanged}/config.yaml' } }), translate(locale, 'Set store: {p0} in {p1}. Preserve other keys and comments.', { p0: 'shared-id', p1: '/project/{unchanged}/config.yaml' }))
    if (locale !== 'en') assert.equal(relativeAge(0, 120_000), new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' }).format(-2, 'minute'))
  }
  setLocale('en')
})
