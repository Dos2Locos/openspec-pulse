import { setLocale } from '../i18n'
import { assert, test } from 'orca/testing'
import { codeSegments, formatDate, summarize } from './text'

test('splits inline code and keeps an unmatched backtick as text', () => {
  assert.deepEqual(codeSegments('run `npm test` now'), [
    { text: 'run ', code: false },
    { text: 'npm test', code: true },
    { text: ' now', code: false }
  ])
  assert.deepEqual(codeSegments('a `b` c `d'), [
    { text: 'a ', code: false },
    { text: 'b', code: true },
    { text: ' c `d', code: false }
  ])
})

test('summarizes to the first sentence, ignoring numbering dots', () => {
  assert.deepEqual(summarize('4.1 API de revisión: anexo visible. Hecho el 26/11 en local.'), {
    summary: '4.1 API de revisión: anexo visible.',
    truncated: true
  })
  assert.deepEqual(summarize('1.1 Short task'), { summary: '1.1 Short task', truncated: false })
  assert.deepEqual(summarize('One sentence.'), { summary: 'One sentence.', truncated: false })
  const long = `${'word '.repeat(50)}end`
  const { summary, truncated } = summarize(long)
  assert.ok(truncated && summary.endsWith('…') && summary.length <= 161)
})

test('formats calendar dates in the effective UI locale without shifting the day', () => {
  for (const locale of ['en', 'es-ES', 'zh-Hans'] as const) {
    setLocale(locale)
    for (const date of ['2026-11-26', '2026-01-05']) assert.equal(formatDate(date), new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(date + 'T00:00:00Z')))
  }
  setLocale('en')
})
