import { assert, test } from 'orca/testing'
import { parseWorkflow } from './config'
import { deliveryStatus, parsePullRequests, requiredLogin, ticketFor, type DeliveryInfo } from './delivery'
import { GithubDelivery, type GhRun } from './github'
const config = { schemaVersion: 1 as const, tickets: [{ prefix: 'FAM', url: 'https://tracker.example/browse/{ticket}' }], github: { repositories: ['example/project'], match: 'ticket-in-title' as const } }
const ticket = ticketFor('fam-123-add-feature', config.tickets)!
const row = (title = 'FAM-123 feature', repository = 'example/project', state = 'OPEN') => ({ number: 1, title, url: `https://github.com/${repository}/pull/1`, state })
const input = { key: 'root:config', cwd: '/tmp', binary: '/usr/bin/gh', login: 'temperatio', requiredLogin: null, github: config.github, ticket, validate: async () => {} }

test('validates bounded ticket rules, HTTPS templates and declared repositories', () => {
  assert.deepEqual(parseWorkflow(JSON.stringify(config)), config)
  for (const patch of [
    { tickets: [{ prefix: 'F.*', url: config.tickets[0].url }] },
    { tickets: [{ prefix: 'FAM', url: 'http://example/{ticket}' }] },
    { tickets: [{ prefix: 'FAM', url: 'https://{ticket}.example/' }] },
    { tickets: [{ prefix: 'FAM', url: 'https://user:pass@example/{ticket}' }] },
    { tickets: [{ prefix: 'FAM', url: 'https://example/{ticket}/{other}' }] },
    { tickets: [...config.tickets, ...config.tickets] },
    { github: { repositories: ['example/project', 'EXAMPLE/project'], match: 'ticket-in-title' } },
    { github: { repositories: ['--other'], match: 'ticket-in-title' } },
    { github: { ...config.github, login: 'secret' } }
  ]) assert.throws(() => parseWorkflow(JSON.stringify({ ...config, ...patch })))
  assert.equal(requiredLogin({ ...config, github: { ...config.github, repositories: ['Dos2Locos/openspec-pulse'] } }), 'temperatio')
  assert.equal(ticket.id, 'FAM-123')
  for (const name of ['prefix-fam-123', 'fam-123abc', 'fam-123_feature', 'fam123']) assert.equal(ticketFor(name, config.tickets), null)
})

test('matches exact ticket boundaries and repository; ignores unsafe and foreign links', () => {
  const prs = parsePullRequests(JSON.stringify([row(), row('FAM-1234'), row('FAM-12'), row('XFAM-123'), row('FAM-123', 'foreign/repo'), { ...row(), url: 'https://github.com@example.org/example/project/pull/1' }]), 'example/project', 'FAM-123')
  assert.equal(prs.length, 1)
  assert.ok(prs[0].reason.includes('Title contains FAM-123'))
  assert.throws(() => parsePullRequests(JSON.stringify(Array(100).fill(row())), 'example/project', 'FAM-123'))
})

test('delivery evidence stays independent from checkboxes', () => {
  const info: DeliveryInfo = { ticket, freshness: 'current', checkedAt: 1, prs: parsePullRequests(JSON.stringify([row()]), 'example/project', ticket.id), error: null }
  assert.equal(deliveryStatus(info, { done: 10, total: 10 }), 'In review')
  info.prs[0].state = 'MERGED'
  assert.equal(deliveryStatus(info, { done: 9, total: 10 }), 'Merged with tasks pending')
  assert.equal(deliveryStatus(info, { done: 10, total: 10 }), 'Merged')
  assert.equal(deliveryStatus({ ...info, freshness: 'unknown' }, { done: 10, total: 10 }), 'Unknown')
  assert.equal(deliveryStatus({ ...info, prs: [] }, null), 'No PRs')
})

test('uses explicit credentials, checks effective identity and never falls back', async () => {
  const calls: string[][] = []
  const service = new GithubDelivery(async (_binary, args, options) => {
    calls.push(args)
    if (args[0] === 'auth') { assert.equal(options.env.GH_TOKEN, undefined); return { stdout: 'test-token' } }
    assert.equal(options.env.GH_TOKEN, 'test-token')
    assert.equal(options.env.GITHUB_TOKEN, undefined)
    return { stdout: '{"login":"wrong-user"}' }
  })
  const answer = await service.get(input)
  assert.equal(answer.freshness, 'unknown')
  assert.ok(answer.error?.includes('identity differs'))
  assert.deepEqual(calls[0], ['auth', 'token', '--hostname', 'github.com', '--user', 'temperatio'])
  assert.equal(calls.length, 2)
  assert.equal((await service.get({ ...input, login: 'other', requiredLogin: 'temperatio' })).freshness, 'unknown')
  assert.equal(calls.length, 2)
})

test('cache TTL, coalescing, cooldown, stale last success and unknown failures', async () => {
  let now = 1000, fail = false, calls = 0
  const run: GhRun = async (_binary, args) => {
    calls++
    if (fail) throw new Error('secret-token must never reach the panel')
    return { stdout: args[0] === 'auth' ? 'test-token' : args[0] === 'api' ? '{"login":"temperatio"}' : JSON.stringify([row()]) }
  }
  const service = new GithubDelivery(run, () => now)
  const [one, two] = await Promise.all([service.get(input), service.get(input)])
  assert.deepEqual(one, two)
  assert.equal(calls, 3)
  now += 299_999
  assert.equal((await service.get(input)).freshness, 'current')
  assert.equal(calls, 3)
  now += 1; fail = true
  const stale = await service.get(input)
  assert.equal(stale.freshness, 'stale')
  assert.equal(stale.checkedAt, 1000)
  assert.equal(stale.prs.length, 1)
  assert.ok(!stale.error?.includes('secret-token'))
  await service.get(input)
  assert.equal(calls, 4)
  now += 60_000; fail = false
  assert.equal((await service.get(input)).freshness, 'current')
  assert.equal((await service.get({ ...input, key: 'other-root', binary: null })).freshness, 'unknown')
  assert.equal((await service.get({ ...input, key: 'no-account', login: null })).freshness, 'unknown')
  fail = true
  assert.equal((await service.get({ ...input, key: 'network-failure' })).freshness, 'unknown')
})

test('network/rate-limit errors preserve data; concurrent CLI jobs are capped at three', async () => {
  let active = 0, peak = 0, fail = false
  const service = new GithubDelivery(async (_binary, args) => {
    active++; peak = Math.max(peak, active)
    await new Promise(resolve => setTimeout(resolve, 2))
    active--
    if (args[0] === 'pr' && fail) throw new Error('HTTP 429 rate limit')
    return { stdout: args[0] === 'auth' ? 'test-token' : args[0] === 'api' ? '{"login":"temperatio"}' : '[]' }
  })
  await Promise.all(Array.from({ length: 12 }, (_, i) => service.get({ ...input, key: `root-${i}` })))
  assert.equal(peak, 3)
  fail = true
  const result = await service.get({ ...input, key: 'rate-limit' })
  assert.equal(result.freshness, 'unknown')
  assert.ok(result.error?.includes('rate limit'))
})

test('workspace invalidation propagates without network requests', async () => {
  let called = false
  const service = new GithubDelivery(async () => { called = true; return { stdout: '' } })
  await assert.rejects(service.get({ ...input, validate: async () => { throw Object.assign(new Error('changed'), { code: 'workspace_changed' }) } }))
  assert.equal(called, false)
})
