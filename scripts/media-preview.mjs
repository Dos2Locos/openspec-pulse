import { registerHooks } from 'node:module'
// Shipping modules use extensionless imports; the Node preview resolves them as TypeScript.
registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context) }
  catch (error) { if (specifier.startsWith('.')) return next(specifier + '.ts', context); throw error }
} })
const { PRICE_DATE, PRICE_SOURCES, estimateUsage } = await import('../src/usage-pricing.ts')
const { aggregateSpend } = await import('../src/spend.ts')
// Renders the shipping panel modules with a sample host. No workspace access or agent calls.
// Open http://127.0.0.1:4177/?view=workflow&theme=light at 1600×1000.
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve, extname, sep } from 'node:path'
import ts from 'typescript'

const root = resolve(fileURLToPath(new URL('../', import.meta.url)))
const clock = Date.parse('2026-11-26T12:00:00Z')
const artifacts = ['proposal.md', 'specs/', 'design.md', 'tasks.md']
const changes = [
  { name: 'add-team-invitations', artifacts, tasks: { done: 5, total: 8 }, updatedAt: clock - 180_000 },
  { name: 'add-audit-log', artifacts, tasks: { done: 0, total: 6 }, updatedAt: clock - 900_000 },
  { name: 'improve-search', artifacts, tasks: { done: 7, total: 7 }, updatedAt: clock - 1_800_000 },
  { name: 'explore-workspace-roles', artifacts: ['proposal.md'], tasks: null, updatedAt: clock - 3_600_000 }
]
// Sample dependency data for ordering, unresolved references and cycle review.
changes[0].ordering = { dependencies: ['add-audit-log'], satisfied: [], createdAt: 2, order: null, warnings: [] }
changes[1].ordering = { dependencies: [], satisfied: [], createdAt: 1, order: null, warnings: [] }
changes[2].ordering = { dependencies: ['unknown-change'], satisfied: [], createdAt: 3, order: null, warnings: [] }
changes[3].ordering = { dependencies: ['explore-workspace-roles'], satisfied: [], createdAt: 4, order: null, warnings: [] }
const detail = {
  related: [{ source: 'active', name: 'add-audit-log' }, { source: 'archive', name: 'add-team-invitations', folder: '2026-11-24-add-team-invitations' }],
  ...changes[0], workspaceId: 'sample', tasksFingerprint: 'sample-fingerprint', specs: ['specs/invitations/spec.md'], sections: [
    { title: '1. Invitation flow', tasks: [
      { text: '1.1 Define invitation requirements', done: true },
      { text: '1.2 Add the invitation endpoint', done: true },
      { text: '1.3 Validate email and workspace role', done: true },
      { text: '1.4 Show pending invitations', done: true }
    ] },
    { title: '2. Verification', tasks: [
      { text: '2.1 Test accepted invitations', done: true },
      { text: '2.2 Test expired invitation links', done: false },
      { text: '2.3 Verify workspace permissions', done: false },
      { text: '2.4 Review the invitation experience', done: false }
    ] }
  ]
}
const archive = [
  { name: 'add-workspace-switcher', date: '2026-11-24', tasks: { done: 12, total: 12 } },
  { name: 'improve-onboarding', date: '2026-11-20', tasks: { done: 9, total: 9 } },
  { name: 'add-project-search', date: '2026-11-18', tasks: { done: 6, total: 6 } }
].map(change => ({ ...change, artifacts, updatedAt: clock, folder: `${change.date}-${change.name}` }))
const specs = [
  { capability: 'invitations', purpose: 'Invite teammates to collaborate in a workspace.', requirements: 5 },
  { capability: 'onboarding', purpose: 'Guide new members through their first project.', requirements: 4 },
  { capability: 'project-search', purpose: 'Find projects and changes across the workspace.', requirements: 6 },
  { capability: 'workspace-navigation', purpose: 'Switch between workspaces without losing context.', requirements: 3 }
]
const list = { status: 'ok', workspace: 'team-dashboard', changes, archived: archive.length, specs: specs.length }

const artifactPreview = await readFile(resolve(root, 'fixtures/board/openspec/changes/add-preview/proposal.md'), 'utf8')

const spendFixture = aggregateSpend('sample-spend', [
  { identity: 'active', lines: (await readFile(resolve(root, 'fixtures/spend/openspec/changes/app-example/agent-runs.jsonl'), 'utf8')).split('\n'), truncated: false },
  { identity: 'archive', lines: (await readFile(resolve(root, 'fixtures/spend/openspec/changes/archive/2026-11-01-app-old/agent-runs.jsonl'), 'utf8')).split('\n'), truncated: false },
  { identity: 'extra', unattributed: true, lines: (await readFile(resolve(root, 'fixtures/spend/metrics/agent-runs/extra.jsonl'), 'utf8')).split('\n'), truncated: true }
])
function previewSpend(scenario) {
  if (scenario === 'spend-empty') return aggregateSpend('empty', [])
  if (scenario === 'spend-tokens') return aggregateSpend('tokens', [{ identity: 'tokens', lines: ['{"inputTokens":100}'], truncated: false }])
  if (scenario === 'spend-zero') return aggregateSpend('zero', [{ identity: 'zero', lines: ['{"costUsd":0}'], truncated: false }])
  if (scenario === 'spend-many') return aggregateSpend('many', [{ identity: 'many', lines: Array.from({ length: 85 }, (_, i) => JSON.stringify({ costUsd: 0.01, task: 'task-' + String(i).padStart(3, '0') })), truncated: false }])
  const data = structuredClone(spendFixture)
  if (scenario === 'spend-error') { data.diagnostics.excluded = 1; data.warnings = ['logs/escape.jsonl: Symbolic links are excluded from run paths.'] }
  return data
}

function previewUsage(scenario) {
  const examples = scenario === 'usage-empty' ? [] : scenario === 'usage-many' ? Array.from({ length: 85 }, (_, i) => ({ agent: 'Codex', model: 'unpriced-' + String(i).padStart(3, '0'), input: 100, cached: 10, output: 10, write5m: 0, write1h: 0 })) : [
    { agent: 'Claude Code', model: scenario === 'usage-unpriced' ? 'future-model' : 'claude-sonnet-5-5', input: 10000, cached: 50000, output: 3000, write5m: 5000, write1h: 0 },
    { agent: 'Codex', model: 'gpt-6.2-sol', input: 5000, cached: 20000, output: 2000, write5m: 0, write1h: 0 }
  ];
  const lines = examples.map((e, i) => {
    const cost = estimateUsage(e.model, { input: e.input, output: e.output, cached: e.cached, write5m: e.write5m, write1h: e.write1h });
    return JSON.stringify({ id: 'usage-' + i, task: e.agent, model: e.model, at: '2026-11-27T09:00:00Z', inputTokens: e.input + e.cached + e.write5m, outputTokens: e.output, ...(cost === null ? {} : {costUsd: cost}) });
  });
  return { spend: aggregateSpend('automatic-preview', [{ identity: 'usage', lines, truncated: false }]), cacheReadTokens: examples.reduce((n, e) => n + e.cached, 0), cacheWriteTokens: examples.reduce((n, e) => n + e.write5m, 0), files: examples.length, discarded: 0, truncated: scenario === 'usage-truncated' ? 1 : 0, warnings: scenario === 'usage-truncated' ? ['Sesión recortada: cobertura parcial.'] : [], priceDate: PRICE_DATE, priceSources: PRICE_SOURCES };
}

function host(view, scenario, locale = 'en', initialTab = view) {
  return `
    Date.now = () => ${clock};
    const detail = ${JSON.stringify(detail)};
    if (${JSON.stringify(scenario)} === 'empty') { detail.sections = []; detail.tasks = { done: 0, total: 0 }; }
    if (${JSON.stringify(scenario)} === 'relations-many') detail.related = Array.from({ length: 85 }, (_, i) => ({ source: 'active', name: 'related-' + String(i).padStart(3, '0') }));
    if (${JSON.stringify(scenario)} === 'relations-empty') detail.related = [];
    const workflow = { config: { schemaVersion: 1, requiredArtifacts: ['design.md'], resumePrefixes: ['Siguiente:'], commands: { apply: '/custom-apply {change}', propose: '/custom-propose {prompt}', task: '/custom-task {change} {task}' } }, fingerprint: 'sample-workflow', error: null };
    const workflowScenario = ${JSON.stringify(scenario)}?.startsWith('workflow');
    if (workflowScenario) {
      detail.artifacts = detail.artifacts.filter(a => a !== 'design.md'); detail.missingArtifacts = ['design.md']; detail.resume = 'Siguiente: revisar billing.\\nConfirmar los escenarios con el equipo.';
      detail.workflow = workflow;
      if (${JSON.stringify(scenario)} === 'workflow-error') { workflow.config = null; workflow.fingerprint = null; workflow.error = 'openspec/pulse.json: Unknown placeholder {secret} for apply.'; }
    }
    if (${JSON.stringify(scenario)} === 'workflow-empty') { detail.sections = []; detail.tasks = null; detail.resume = null; }
    const previewStorage = new Map();
    const storageListeners = [];
    const pluginListeners = [];
    window.previewChange = async () => { detail.tasks = { done: 8, total: 8 }; detail.sections.forEach(s => s.tasks.forEach(t => t.done = true)); for (const listener of pluginListeners) await listener({}); };

    window.previewStorage = previewStorage;
    window.previewSends = [];
    window.previewStoreCalls = [];
    const storeScenario = ${JSON.stringify(scenario)}?.startsWith('stores');
    let storeRoot = { workspacePath: '/sample/project', dataPath: '/sample/shared', kind: 'store', storeId: 'shared', prefixes: ['billing-'], fingerprint: 'shared-v1', diagnostics: [] };
    if (${JSON.stringify(scenario)} === 'stores-local') storeRoot = { ...storeRoot, kind: 'local', storeId: null, dataPath: '/sample/project', prefixes: [], diagnostics: [] };
    if (storeScenario && storeRoot.kind === 'store') detail.readOnly = true;
    const listeners = new Map();
    let previewWorkspaceId = 'sample';
    window.previewSwitchWorkspace = async id => {
      previewWorkspaceId = id;
      for (const callback of listeners.get('workspace.changed') ?? []) await callback({ context: { workspaceId: id } });
    };
    window.orca = {
      locale: ${JSON.stringify(locale)},
      host: { async call(method) { if (method === 'workspace.readContext') return { workspaceId: previewWorkspaceId }; throw new Error('Unsupported preview host call: ' + method); } },
      ...(${view === 'board' ? 'true' : 'false'} ? { document: { async get() { return { content: { kind: 'text', text: JSON.stringify({ schemaVersion: 1, workspaceId: 'sample' }) } }; }, onDidChange() {} } } : {}),
      on(event, callback) { const callbacks = listeners.get(event) ?? []; callbacks.push(callback); listeners.set(event, callbacks); if (event === 'workspace.changed' && ${JSON.stringify(scenario)} !== 'board-no-replay') queueMicrotask(() => callback({ context: { workspaceId: 'sample' } })); },
      storage: { onDidChange(fn) { storageListeners.push(fn); }, async get(key) { if (previewStorage.has(key)) return previewStorage.get(key); if (!key.startsWith('selected:')) return null; return ${view === 'detail' ? JSON.stringify(detail.name) : 'null'}; }, async set(key, value) { previewStorage.set(key, value); storageListeners.forEach(fn => fn({ key })); }, async delete(key) { previewStorage.delete(key); } },
      plugin: {
        on(event, fn) { if (event === 'changes.changed') pluginListeners.push(fn); },
        async request(name, input) {
          const { translate, resolveLocale } = await import('/src/i18n.js');
          const pt = (key, params) => translate(resolveLocale(window.orca.locale), key, params);
          if (name === 'usage.get') {
            window.previewUsageInputs ??= []; window.previewUsageInputs.push(input);
            if (${JSON.stringify(scenario)} === 'usage-error' || window.previewUsageFail) throw new Error(pt('Usage could not be refreshed.') + ' [external: EACCES /sample/sessions]');
            if (${JSON.stringify(scenario)} === 'usage-delay') await new Promise(resolve => { window.previewResolveUsage = resolve; });
            const usage = ${JSON.stringify(previewUsage(scenario?.startsWith("usage") ? scenario : "usage-empty"))};
            usage.warnings = usage.warnings.map(() => pt('Sesión recortada a 16 MiB / 20.000 líneas: cobertura parcial. Codex omite el primer acumulado sin base.')); return usage;
          }
          if (name === 'stores.info' && window.previewStoresDelay) await new Promise(resolve => {window.previewResolveStores = resolve;});
          if (name === 'stores.info' && window.previewStoresFail) throw new Error(pt('Store operation failed.') + ' [external: ENOENT /sample/store]');
          if (name === 'stores.info') return { local: true, workspaceId: 'sample', root: storeScenario ? storeRoot : null, stores: storeScenario ? [{ id: 'shared', root: '/sample/shared' }, { id: 'other', root: '/sample/other' }] : [], version: ${JSON.stringify(scenario)} === 'stores-incompatible' ? null : '1.14.1', error: ${JSON.stringify(scenario)} === 'stores-unregistered' ? pt("Unknown store '{p0}'. Register it before linking.", {p0:'missing'}) : ${JSON.stringify(scenario)} === 'stores-invalid' ? pt('Data root unavailable. Resolve the diagnostic below.') : ${JSON.stringify(scenario)} === 'stores-incompatible' ? pt('Stores require the tested OpenSpec {p0} contract; installed: {p1}. Local mode remains available.', {p0:'1.14.1',p1:'2.1.0'}) : ${JSON.stringify(scenario)} === 'stores-error' ? pt("Unknown store '{p0}'. Register it before linking.", {p0:'missing'}) : null };
          if (name === 'stores.preview') { window.previewStoreCalls.push({ name, input }); return { token: 'preview-token', effects: [], messages: [{key:'Set store: {p0} in {p1}. Preserve other keys and comments.',params:{p0:input.operation.id ?? 'shared',p1:'/sample/project/openspec/config.yaml'}},{key:'Run OpenSpec store setup with --no-init-git: no Git init, commit, remote or publication.'}] }; }
          if (name === 'stores.commit') { window.previewStoreCalls.push({ name, input }); return { saved: true }; }
          if (name === 'stores.scope.set') { window.previewStoreCalls.push({ name, input }); storeRoot = { ...storeRoot, prefixes: input.prefixes, fingerprint: 'scope-v2' }; return { saved: true }; }
          if (name === 'artifacts.read') {
            if (${JSON.stringify(scenario)} === 'board-error') throw new Error('Artifact read failed. Retry.');
            return { file: input.file, markdown: ${JSON.stringify(artifactPreview).replaceAll('<', '\\u003c')} };
          }
          if (name === 'board.open') return { opened: true };
          if (name === 'delivery.login.set') { previewStorage.set('github-login', input.login); return { login: input.login }; }
          if (name === 'delivery.get') {
            const enabled = ${JSON.stringify(scenario)}?.startsWith('delivery');
            const scenario = ${JSON.stringify(scenario)};
            const all = ${JSON.stringify(changes)};
            const results = Object.fromEntries(input.names.map(name => {
              const index = Math.max(0, all.findIndex(c => c.name === name));
              const unknown = scenario === 'delivery-unknown' || (index === 3 && scenario !== 'delivery-empty');
              const stale = scenario === 'delivery-stale' || index === 1;
              const state = scenario === 'delivery-merged' || index === 1 ? 'MERGED' : 'OPEN';
              return [name, { ticket: { id: 'FAM-' + (123 + index), url: 'https://tracker.example/browse/FAM-' + (123 + index) }, freshness: unknown ? 'unknown' : stale ? 'stale' : 'current', checkedAt: unknown ? null : ${clock - 60000}, error: unknown ? pt('GitHub identity differs from the expected login; no PR query was made.') : stale ? pt('GitHub query failed (network, authentication or rate limit). Retry after 60 seconds.') : null, prs: unknown || scenario === 'delivery-empty' ? [] : [{ number: 42 + index, title: 'FAM-' + (123 + index) + ' feature', url: 'https://github.com/example/project/pull/' + (42 + index), repository: 'example/project', state, reason: pt('Title contains {p0} · {p1}', {p0:'FAM-' + (123 + index),p1:'example/project'}) }] }];
            }));
            return { workspaceId: input.workspaceId, project: 'sample-project', login: previewStorage.has('github-login') ? previewStorage.get('github-login') : 'temperatio', requiredLogin: 'temperatio', configured: enabled, changes: enabled ? results : {} };
          }
          if (name === 'agent.options') return { workspaceId: 'sample', profiles: [{ id: 'claude-skills', label: 'Claude Code · skills', agent: 'claude', supportsModel: true }, { id: 'codex-skills', label: 'Codex · skills', agent: 'codex', supportsModel: false }], prefs: { profile: 'codex-skills', model: null }, sessions: [], ...(workflowScenario ? { workflow, approvedCommands: [] } : {}) };
          if (name === 'agent.prefs.set') return input.prefs;
          if (name === 'agent.run') {
            window.previewSends.push(input);
            await new Promise(resolve => setTimeout(resolve, 500));
            if (${JSON.stringify(scenario)} === 'conflict') throw new Error('The task changed. Refresh and select it again; nothing was sent.');
            return { surface: 'chat', agent: 'codex' };
          }
          if (${JSON.stringify(scenario)} === 'relations-error' && name === 'specs.detail') throw new Error('Cannot read spec relations. Refresh to retry.');
          if (name === 'specs.detail') return { ...${JSON.stringify(specs)}.find(spec => spec.capability === input.capability), changes: [...new Map([{ source: 'active', name: detail.name }, ...detail.related].map(ref => [ref.source + ':' + (ref.folder ?? ref.name), ref])).values()] };
          if (name === 'specs.open' || name === 'changes.open') return { opened: true };
          if (name === 'archive.detail') return { ...detail, folder: input.folder, date: '2026-11-24', related: [{ source: 'active', name: detail.name }] };
          if (name === 'worktrees.browse' && ['no-openspec', 'stores-unregistered', 'stores-invalid'].includes(${JSON.stringify(scenario)})) return null;
          if (name === 'worktrees.browse') {
            const origins = [{ workspaceId: 'sample', name: 'team-dashboard', branch: 'main' }, { workspaceId: 'sibling', name: 'parallel-worktree', branch: 'feature/search' }];
            const selected = input.scope === 'all' ? origins : origins.filter(w => w.workspaceId === (input.scope === 'focused' ? 'sample' : input.scope));
            const changes = selected.flatMap(origin => (['board-empty', 'lists-empty'].includes(${JSON.stringify(scenario)}) ? [] : ${JSON.stringify(scenario)} === 'lists-many' ? Array.from({length:185}, (_, i) => ({...${JSON.stringify(changes)}[i % 4], name:'many-' + String(i).padStart(3,'0')})) : ${JSON.stringify(changes)}).map(change => ({ ...change, ...(storeScenario && storeRoot.kind === 'store' ? { readOnly: true } : {}), ...(change.name === detail.name ? { tasks: detail.tasks } : {}), origin })));
            const archive = selected.flatMap(origin => (${JSON.stringify(scenario)} === 'lists-empty' ? [] : (${JSON.stringify(scenario)} === 'board-many' ? Array.from({ length: 85 }, (_, i) => ({ ...${JSON.stringify(archive)}[0], name: 'old-' + i, folder: '2026-11-24-old-' + i })) : ${JSON.stringify(archive)})).map(change => ({ ...change, origin })));
            const specs = selected.flatMap(origin => (${JSON.stringify(scenario)} === 'lists-empty' ? [] : ${JSON.stringify(specs)}).map(spec => ({ ...spec, origin })));
            return { ...(${JSON.stringify(scenario)}?.startsWith('spend') ? { spend: ${JSON.stringify(previewSpend(scenario))} } : {}), focusedWorkspaceId: 'sample', worktrees: origins, diagnostics: ${JSON.stringify(scenario)} === 'worktrees-notices' ? ['Cannot verify worktree unavailable; excluded.', 'Cannot verify worktree old-checkout; excluded.'] : [], archive, specs,
              list: { status: 'ok', ...(storeScenario ? { root: storeRoot } : {}), ...(workflowScenario ? { workflow } : {}), workspace: input.scope === 'all' ? 'All worktrees' : selected[0].name, changes, archived: archive.length, specs: specs.length } };
          }
          if (name === 'openspec.init') return ${JSON.stringify(list)};
          if (name === 'changes.list' && ['stores-unregistered', 'stores-invalid'].includes(${JSON.stringify(scenario)})) throw new Error(pt('Data root unavailable. Resolve the diagnostic below.'));
          if (name === 'changes.list' && ${JSON.stringify(scenario)} === 'no-openspec') return { status: 'no-openspec', workspace: 'team-dashboard' };
          if (name === 'changes.list' && ${JSON.stringify(scenario)} === 'remote') return { status: 'remote', workspace: 'team-dashboard' };
          if (name === 'changes.list' && ${JSON.stringify(scenario)} === 'no-workspace') return { status: 'no-workspace' };
          if (name === 'changes.list' && window.previewListDelay) await new Promise(resolve => {window.previewResolveList=resolve;});
          if (name === 'changes.list' && window.previewListFail) throw new Error('Cannot refresh project records. Retry.');
          if (name === 'changes.list') return { ...${JSON.stringify(list)}, ...(storeScenario ? { root: storeRoot } : {}), ...(workflowScenario ? { workflow } : {}) };
          if (name === 'changes.detail') return { ...detail, ...(${JSON.stringify(scenario)}?.startsWith('delivery') ? ${JSON.stringify(changes)}.find(c => c.name === input.name) : {}), workspaceId: input.workspaceId ?? 'sample', name: input.name, related: detail.related.filter(ref => ref.source !== 'active' || ref.name !== input.name) };
          if (name === 'archive.list') return ${JSON.stringify(archive)};
          if (name === 'specs.list') return ${JSON.stringify(specs)};
          throw new Error('Preview only: no workspace writes or agent commands.');
        }
      }
    };
    ${['archive', 'specs', 'stores', 'spend'].includes(initialTab) ? `
    const observer = new MutationObserver(() => {
      const tab = document.querySelector('[data-focus="tab:${initialTab}"]');
      if (tab) { observer.disconnect(); tab.click(); }
    });
    observer.observe(document.body, { childList: true, subtree: true });` : ''}
  `
}

function page(url) {
  const dark = url.searchParams.get('theme') === 'dark'
  const gallery = {
    workflow: {
      title: 'Your specs. In motion.', intro: 'Track change states, task progress and the next action from one panel.',
      frames: [{ view: 'active', label: 'Every change, at a glance' }, { view: 'detail', label: 'The work behind the progress' }]
    },
    library: {
      title: 'A history you can build on.', intro: 'Revisit archived changes and open the specs that define your project.',
      frames: [{ view: 'archive', label: 'Completed proposals' }, { view: 'specs', label: 'Shared capability specs' }]
    },
    board: {
      title: 'The whole workflow. One board.', intro: 'Four local states, shared filters and worktree context in the main area.',
      frames: [{ view: 'board', label: 'A focused workspace board' }]
    },
    tools: {
      title: 'Shared specs. Clear usage.', intro: 'Manage OpenSpec stores and review local Claude Code / Codex usage in dedicated tabs.',
      frames: [{ view: 'stores', scenario: 'stores', label: 'Stores · explicit roots and system scope' },
        { view: 'spend', scenario: 'usage', label: 'Spend · local tokens and estimated API cost' }]
    },
    languages: {
      title: 'Your workflow. Your language.', intro: 'English, Spanish and Simplified Chinese, following the language selected in Orca.',
      frames: [{ view: 'stores', scenario: 'stores', locale: 'es-ES', label: 'Español · Almacenes' },
        { view: 'spend', scenario: 'usage', locale: 'zh-Hans', label: '简体中文 · 费用' }]
    }
  }
  const selected = gallery[url.searchParams.get('view')] ?? gallery.workflow
  const frames = selected.frames
  const toolsGallery = ['tools', 'languages'].includes(url.searchParams.get('view'))
  const zoom = toolsGallery ? 1.1 : 1.25
  const frameHeight = toolsGallery ? 730 : 716
  const frameUrl = frame => '/panel?' + new URLSearchParams({ view: frame.view, theme: dark ? 'dark' : 'light',
    ...(frame.scenario ? { scenario: frame.scenario } : {}), ...(frame.locale ? { locale: frame.locale } : {}) })
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>OpenSpec Pulse — sample gallery</title>
  <style>
  *{box-sizing:border-box} body{margin:0;background:${dark ? '#0e1213' : '#f3f5f2'};color:${dark ? '#eff2e9' : '#17221c'};font-family:system-ui,sans-serif}
  main{width:1600px;height:1000px;padding:48px 64px}
  .eyebrow{font-size:14px;letter-spacing:2px;text-transform:uppercase;color:${dark ? '#b3d96b' : '#456722'}}
  h1{font-size:42px;letter-spacing:-1.5px;margin:10px 0 8px;font-weight:650}
  .intro{margin:0;font-size:18px;color:${dark ? '#a7b1aa' : '#58635c'}}
  .grid{display:grid;grid-template-columns:repeat(${frames.length},minmax(0,1fr));gap:32px;margin-top:30px}
  .label{font-size:14px;font-weight:600;margin:0 0 12px}
  .frame{height:${frameHeight}px;border:1px solid ${dark ? '#303936' : '#d1d8cf'};border-radius:14px;overflow:hidden;background:${dark ? '#0d1117' : '#fff'};box-shadow:0 12px 30px #0000000d}
  iframe{width:${100 / zoom}%;height:${100 / zoom}%;transform:scale(${zoom});transform-origin:top left;border:0;display:block}
  footer{margin-top:18px;font-size:13px;color:${dark ? '#8f9b93' : '#657167'}}
  </style><main><div class="eyebrow">OpenSpec Pulse / Orca community plugin</div>
  <h1>${selected.title}</h1>
  <p class="intro">${selected.intro}</p>
  <div class="grid">${frames.map(frame => `<section><p class="label">${frame.label}</p><div class="frame"><iframe title="${frame.label}" src="${frameUrl(frame)}"></iframe></div></section>`).join('')}</div>
  <footer>Actual plugin interface · Sample workspace data · ${dark ? 'Dark' : 'Light'} theme</footer></main></html>`
}

function panel(url) {
  const dark = url.searchParams.get('theme') === 'dark'
  const palette = dark
    ? ['#0d1117', '#e6edf3', '#161b22', '#21262d', '#8b949e', '#30363d', '#dce5e1', '#101713', '#f85149']
    : ['#ffffff', '#1f2328', '#f6f8fa', '#f0f2f4', '#656d76', '#d0d7de', '#253c2b', '#ffffff', '#cf222e']
  const keys = ['background', 'foreground', 'card', 'muted', 'muted-foreground', 'border', 'primary', 'primary-foreground', 'destructive']
  return `<!doctype html><html lang="en" class="${dark ? 'dark' : ''}"><meta charset="utf-8"><style>:root{${keys.map((key, i) => `--orca-${key}:${palette[i]}`).join(';')};--orca-ring:#749c4a;--orca-radius:8px}</style><body><div id="root"></div><script>${host(url.searchParams.get('view'), url.searchParams.get('scenario'), url.searchParams.get('locale') ?? 'en', url.searchParams.get('tab') ?? url.searchParams.get('view'))}</script><script type="module" src="/src/panel/main.js"></script></body></html>`
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1')
    if (url.pathname === '/' || url.pathname === '/panel') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      return res.end(url.pathname === '/' ? page(url) : panel(url))
    }
    const path = resolve(root, `.${decodeURIComponent(url.pathname)}`)
    if (!path.startsWith(root + sep) || !(url.pathname.startsWith('/src/') || url.pathname === '/orca-plugin.json')) {
      res.writeHead(404).end(); return
    }
    if (extname(path) === '.js') {
      const source = await readFile(path.slice(0, -3) + '.ts', 'utf8')
      const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
        .replace(/from (['"])(\.[^'"]+)\1/g, (_, quote, specifier) => `from ${quote}${specifier}.js${quote}`)
      res.setHeader('Content-Type', 'text/javascript; charset=utf-8'); res.end(output)
    } else {
      res.setHeader('Content-Type', extname(path) === '.css' ? 'text/css' : 'application/json')
      res.end(await readFile(path))
    }
  } catch {
    res.writeHead(404).end()
  }
})
server.listen(Number(process.env.PULSE_PREVIEW_PORT ?? 4177), '127.0.0.1', () => console.log('Media preview listening on', server.address()))
