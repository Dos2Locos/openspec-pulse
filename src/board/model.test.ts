import { assert, test } from 'orca/testing'
import { boardColumns, boardMarker, markerWorkspace } from './model'
import { inlineMarkdown, markdownBlocks, safeLink } from '../markdown'

test('board markers bind a versioned workspace and reject unknown documents', () => {
  assert.equal(markerWorkspace(boardMarker('w1')), 'w1')
  for (const text of ['', '{}', 'null', '{"schemaVersion":2,"workspaceId":"w1"}']) assert.equal(markerWorkspace(text), null)
})
test('board derives progress using the same states as the panel without mutation', () => {
  const change = { name: 'x', artifacts: ['tasks.md' as const], tasks: { done: 1, total: 2 }, updatedAt: 0 }
  assert.equal(boardColumns([change]).find(c => c.state === 'in-progress')?.changes[0], change)
  assert.equal(boardColumns([{ ...change, tasks: { done: 2, total: 2 } }]).find(c => c.state === 'done')?.changes.length, 1)
})
test('Markdown preserves active HTML as text and permits only explicit web links', () => {
  const payload = '<script>alert(1)</script><img src=x onerror=alert(1)>'
  assert.deepEqual(markdownBlocks(payload), [{ kind: 'paragraph', text: payload }])
  for (const url of ['javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd', '../tasks.md', '//evil.example', 'https://user:pass@example.com']) assert.equal(safeLink(url), null)
  assert.equal(safeLink('https://example.com/a'), 'https://example.com/a')
  assert.deepEqual(inlineMarkdown('[bad](javascript:evil)'), [{ kind: 'link', text: 'bad', href: null }])
  assert.deepEqual(markdownBlocks('```html\n' + payload + '\n```'), [{ kind: 'code', text: payload }])
})
