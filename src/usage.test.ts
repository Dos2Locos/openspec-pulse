import { assert, test } from 'orca/testing'
import { mkdtemp, realpath, mkdir, writeFile, appendFile, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { claudeUsage, codexUsage, summarizeUsage } from './usage'
import { estimateUsage } from './usage-pricing'
import { AgentUsageReader } from './usage-reader'
const json = JSON.stringify
const claude = (cwd: string, id: string, output = 10, model = 'claude-sonnet-5-5') => json({ type: 'assistant', cwd, timestamp: '2026-11-27T10:00:00Z', message: { id, model, content: [{ text: 'PRIVATE CONVERSATION MUST NOT LEAVE READER' }], usage: { input_tokens: 100, output_tokens: output, cache_read_input_tokens: 500, cache_creation_input_tokens: 20, cache_creation: { ephemeral_5m_input_tokens: 15, ephemeral_1h_input_tokens: 5 } } } })
const context = (cwd: string, model = 'gpt-6.2-sol') => json({ type: 'turn_context', payload: { cwd, model } })
const counter = (n: number, timestamp = String(n)) => json({ timestamp, type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: { input_tokens: n * 1000, cached_input_tokens: n * 800, cache_write_input_tokens: n * 50, output_tokens: n * 100, reasoning_output_tokens: n * 30 } } } })

test('API equivalent pricing separates cache and output and never guesses unknown models', () => {
  const tokens = { input: 1000, output: 200, cached: 1000, write5m: 1000, write1h: 0 }
  assert.ok(Math.abs(estimateUsage('claude-sonnet-5-5', tokens)! - .0066) < 1e-12)
  assert.equal(estimateUsage('claude-sonnet-5-5-20261101', tokens), estimateUsage('claude-sonnet-5-5', tokens))
  assert.equal(estimateUsage('future-model', tokens), null)
  assert.equal(estimateUsage('gpt-6.2-sol', tokens, 'flex'), null)
  assert.equal(estimateUsage('claude-sonnet-5-5', tokens, 'fast'), null)
  assert.equal(estimateUsage('gpt-6.2-sol', tokens, 'fast'), estimateUsage('gpt-6.2-sol', tokens)! * 2)
  assert.equal(estimateUsage('claude-opus-5-5', tokens, 'fast'), estimateUsage('claude-opus-5-5', tokens)! * 2)
  assert.equal(estimateUsage('gpt-6.2-sol', { ...tokens, input: -1 }), null)
  assert.ok(estimateUsage('claude-haiku-5-5', { ...tokens, input: 98001 })! > estimateUsage('claude-haiku-5-5', { ...tokens, input: 98000 })! * 2)
})

test('Claude chunks deduplicate by message ID, keep final counts and isolate cwd', () => {
  const read = claudeUsage([claude('/project', 'same', 1), claude('/project', 'same', 40), claude('/other', 'secret', 9999), claude('/project', 'subagent')], '/project')
  assert.equal(read.events.length, 2)
  assert.equal(read.events[0].tokens.output, 40)
  assert.equal(read.events[0].tokens.write1h, 5)
  const summary = summarizeUsage([read, read], 'test')
  assert.equal(summary.spend.total.events, 2)
  assert.equal(summary.spend.total.outputTokens, 50)
  assert.equal(summary.spend.total.inputTokens, 1240)
  assert.equal(summary.cacheReadTokens, 1000)
  assert.equal(json(summary).includes('PRIVATE CONVERSATION'), false)
  assert.equal(json(summary).includes('secret'), false)
  assert.equal(summarizeUsage([claudeUsage([claude('/project', 'new', 1, 'unknown-model')], '/project')], 'test').spend.total.unknownCosts, 1)
  const invalid = JSON.parse(claude('/project', 'negative')); invalid.message.usage.input_tokens = -1
  assert.equal(claudeUsage([json(invalid)], '/project').discarded, 1)
})

test('Codex uses cumulative deltas, includes cached input once and never re-adds reasoning', () => {
  const meta = { id: 'session', cwd: '/project' }
  const lines = [context('/project'), counter(1), counter(1), counter(2), context('/project', 'gpt-6.1-sol'), counter(3)]
  const read = codexUsage(lines, '/project', meta)
  const summary = summarizeUsage([read, read], 'test')
  assert.equal(summary.spend.total.events, 3)
  assert.equal(summary.spend.total.inputTokens, 3000)
  assert.equal(summary.spend.total.outputTokens, 300)
  assert.equal(summary.cacheReadTokens, 2400)
  assert.equal(summary.cacheWriteTokens, 150)
  assert.equal(summary.spend.byModel['gpt-6.1-sol'].outputTokens, 100)
  assert.equal(summarizeUsage([codexUsage(lines, '/project', meta, true)], 'test').spend.total.inputTokens, 2000)
  const shifted = codexUsage([context('/other'), counter(1), context('/project'), counter(2)], '/project', meta)
  assert.equal(summarizeUsage([shifted], 'test').spend.total.inputTokens, 1000)
  assert.equal(codexUsage(lines, '/other', meta).files, 0)
})

test('local discovery scopes metadata, handles subagents, refreshes cache and excludes symlinks', async () => {
  const base = await realpath(await mkdtemp(join(tmpdir(), 'pulse-auto-usage-')))
  const project = join(base, 'project'), other = join(base, 'other'), ch = join(base, 'claude'), co = join(base, 'codex')
  try {
    await mkdir(project); await mkdir(other)
    const folder = join(ch, 'projects', project.replace(/[^a-zA-Z0-9-]/g, '-'))
    await mkdir(join(folder, 'session/subagents'), { recursive: true }); await mkdir(join(co, 'sessions/2026/11/27'), { recursive: true })
    const log = join(folder, 'main.jsonl')
    await writeFile(log, claude(project, 'main') + '\n')
    await writeFile(join(folder, 'session/subagents/agent-one.jsonl'), claude(project, 'sub') + '\n')
    const codexLog = join(co, 'sessions/2026/11/27/session.jsonl')
    await writeFile(codexLog, [json({ type: 'session_meta', payload: { id: 'codex', cwd: project } }), context(project), counter(1)].join('\n') + '\n')
    await writeFile(join(co, 'sessions/foreign.jsonl'), json({ type: 'session_meta', payload: { id: 'foreign', cwd: other } }) + '\nNOT A VALID PROJECT SESSION\n')
    await symlink(log, join(folder, 'symlink.jsonl'))
    const reader = new AgentUsageReader(async () => ({ claude: [ch, ch], codex: [co, co] }))
    const first = await reader.read(project)
    assert.equal(first.files, 3)
    assert.equal(first.events.length, 3)
    assert.equal(first.discarded, 0)
    assert.ok(first.warnings.some(w => w.includes('symbolic')))
    assert.equal(json(first).includes('PRIVATE CONVERSATION'), false)
    assert.deepEqual(await reader.read(project), first)
    await appendFile(log, claude(project, 'new', 99) + '\n')
    assert.equal((await reader.read(project)).events.length, 4)
    assert.equal((await reader.read(other)).events.length, 0)
    const disabledHome = new AgentUsageReader(async () => ({ claude: [], codex: [] }))
    assert.equal((await disabledHome.read(project)).files, 0)
  } finally { await rm(base, { recursive: true, force: true }) }
})
