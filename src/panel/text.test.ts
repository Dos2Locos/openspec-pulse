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

test('formats an archive date with a fixed English month', () => {
  assert.equal(formatDate('2026-11-26'), '26 Nov 2026')
  assert.equal(formatDate('2026-01-05'), '5 Jan 2026')
})
