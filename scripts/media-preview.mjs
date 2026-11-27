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
const detail = {
  ...changes[0], specs: ['specs/invitations/spec.md'], sections: [
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

function host(view) {
  return `
    Date.now = () => ${clock};
    const detail = ${JSON.stringify(detail)};
    window.orca = {
      on(event, callback) { queueMicrotask(() => callback({ context: { workspaceId: 'sample' } })); },
      storage: { async get() { return ${view === 'detail' ? JSON.stringify(detail.name) : 'null'}; }, async set() {}, async delete() {} },
      plugin: {
        on() {},
        async request(name) {
          if (name === 'changes.list') return ${JSON.stringify(list)};
          if (name === 'changes.detail') return detail;
          if (name === 'archive.list') return ${JSON.stringify(archive)};
          if (name === 'specs.list') return ${JSON.stringify(specs)};
          throw new Error('Preview only: no workspace writes or agent commands.');
        }
      }
    };
    ${['archive', 'specs'].includes(view) ? `
    const observer = new MutationObserver(() => {
      const tab = [...document.querySelectorAll('.tab')].find(el => el.textContent.startsWith('${view === 'archive' ? 'Archive' : 'Specs'}'));
      if (tab) { observer.disconnect(); tab.click(); }
    });
    observer.observe(document.body, { childList: true, subtree: true });` : ''}
  `
}

function page(url) {
  const dark = url.searchParams.get('theme') === 'dark'
  const collection = url.searchParams.get('view') === 'library'
  const frames = collection ? ['archive', 'specs'] : ['active', 'detail']
  const labels = collection ? ['Completed proposals', 'Shared capability specs'] : ['Every change, at a glance', 'The work behind the progress']
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>OpenSpec Pulse — sample gallery</title>
  <style>
  *{box-sizing:border-box} body{margin:0;background:${dark ? '#0e1213' : '#f3f5f2'};color:${dark ? '#eff2e9' : '#17221c'};font-family:system-ui,sans-serif}
  main{width:1600px;height:1000px;padding:48px 64px}
  .eyebrow{font-size:14px;letter-spacing:2px;text-transform:uppercase;color:${dark ? '#b3d96b' : '#456722'}}
  h1{font-size:42px;letter-spacing:-1.5px;margin:10px 0 8px;font-weight:650}
  .intro{margin:0;font-size:18px;color:${dark ? '#a7b1aa' : '#58635c'}}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-top:30px}
  .label{font-size:14px;font-weight:600;margin:0 0 12px}
  .frame{height:716px;border:1px solid ${dark ? '#303936' : '#d1d8cf'};border-radius:14px;overflow:hidden;background:${dark ? '#0d1117' : '#fff'};box-shadow:0 12px 30px #0000000d}
  iframe{width:80%;height:80%;transform:scale(1.25);transform-origin:top left;border:0;display:block}
  footer{margin-top:18px;font-size:13px;color:${dark ? '#8f9b93' : '#657167'}}
  </style><main><div class="eyebrow">OpenSpec Pulse / Orca community plugin</div>
  <h1>${collection ? 'A history you can build on.' : 'Your specs. In motion.'}</h1>
  <p class="intro">${collection ? 'Revisit archived changes and open the specs that define your project.' : 'Track change states, task progress and the next action from one panel.'}</p>
  <div class="grid">${frames.map((view, i) => `<section><p class="label">${labels[i]}</p><div class="frame"><iframe title="${labels[i]}" src="/panel?view=${view}&theme=${dark ? 'dark' : 'light'}"></iframe></div></section>`).join('')}</div>
  <footer>Actual plugin interface · Sample workspace data · ${dark ? 'Dark' : 'Light'} theme</footer></main></html>`
}

function panel(url) {
  const dark = url.searchParams.get('theme') === 'dark'
  const palette = dark
    ? ['#0d1117', '#e6edf3', '#161b22', '#21262d', '#8b949e', '#30363d', '#dce5e1', '#101713', '#f85149']
    : ['#ffffff', '#1f2328', '#f6f8fa', '#f0f2f4', '#656d76', '#d0d7de', '#253c2b', '#ffffff', '#cf222e']
  const keys = ['background', 'foreground', 'card', 'muted', 'muted-foreground', 'border', 'primary', 'primary-foreground', 'destructive']
  return `<!doctype html><html lang="en" class="${dark ? 'dark' : ''}"><meta charset="utf-8"><style>:root{${keys.map((key, i) => `--orca-${key}:${palette[i]}`).join(';')};--orca-ring:#749c4a;--orca-radius:8px}</style><body><div id="root"></div><script>${host(url.searchParams.get('view'))}</script><script type="module" src="/src/panel/main.js"></script></body></html>`
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
server.listen(4177, '127.0.0.1', () => console.log('Media preview: http://127.0.0.1:4177/ (capture at 1600×1000)'))
