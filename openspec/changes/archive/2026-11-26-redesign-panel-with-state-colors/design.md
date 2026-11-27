# Design

## Context

- Today the panel is a `components` panel (`src/panel.tsx` and `src/actions.tsx`). Colour there is
  limited to five tones, and `Progress` takes none. See proposal.md (Why) for what the orca.dev
  panels do instead.
- The worker (`src/worker.ts`) and the request contract (`src/protocol.ts`) cover the panel's
  data:
  - requests: `changes.list`, `changes.detail`, `changes.open`, `openspec.init` and `agent.run`;
  - event: `changes.changed`.

  The worker only learns of a workspace switch when the panel asks.
- html panels (`sandboxed-ui`) run in an isolated frame:
  - `window.orca.plugin.request/on` reach the same worker handlers;
  - `orca.on('workspace.changed' | 'theme')` hears Orca;
  - a `.ts` entry loads with no build step (`>=1.4.246`);
  - the network is closed, so every asset is a local file.

  The theme reaches CSS as `--orca-background`, `--orca-foreground`, `--orca-card`,
  `--orca-primary`, `--orca-muted`, `--orca-muted-foreground`, `--orca-border`,
  `--orca-destructive`, `--orca-ring`, `--orca-radius`, `--orca-font-sans` and `--orca-font-mono`,
  plus a `light` or `dark` class on `<html>`. There is no success or warning token.
- `orca plugin check` and the `mount` test kit only render components panels. html panels are
  checked with `orca plugin shot <key> [--theme light|dark]` on the live panel.
- Status bar items (since 1.4.248):
  - fields `id`, `text`, `icon`, `tone`, a `tooltip` of up to 256 characters and `command`;
  - a worker updates them with `statusBar.update`, which needs no capability;
  - with `main`, Orca keeps the worker running.
- No host call opens a panel. Orca's CLI does (`orca plugin open <key> --panel <id>`). Fleet
  Monitor uses it for its status bar command, and our worker already runs that CLI for chats.

## Goals / Non-Goals

**Goals:**
- One pure module for the state, next step and summary of a change, used by the panel and the
  worker and tested in Node, so the strip, the cards and the status bar always agree.
- A panel that looks native in any Orca theme: Orca's surfaces, fonts and radius, with colour
  added only for state.
- Keep every current behaviour: initialize, open files, the agent commands and the per-workspace
  selection.

**Non-Goals:**
- No UI framework or bundler. No JSX runtime: the frame gets plain TypeScript and DOM.
- No custom-colour settings and no browser-client (`orca serve`) support.

## Decisions

1. **Pure modules, then a thin DOM layer.**
   - `src/state.ts`:
     - `changeState(change)` returns `drafting | not-started | in-progress | done`;
     - `nextStep(change)` returns `{ action, label }`;
     - `steps(change)` returns the stepper marks;
     - `stateCounts(changes)`;
     - `statusBarSummary(listState)`;
     - `relativeAge(ms, now)`.

     It has no Orca or DOM imports, and `src/state.test.ts` covers it through `orca plugin test`.
   - `src/panel/main.ts` keeps a small state object and calls `render()`, which rebuilds the
     panel's DOM from it.
   - `src/panel/dom.ts` holds a tiny `h(tag, attrs, children)` helper. It builds text with
     `textContent` and never `innerHTML`, so change names and task text can never inject markup.

   Alternatives:
   - Preact or lit as relative files: rejected, they are an extra dependency for one small view.
   - Keeping components and adding an html sub-frame: rejected, it gives two UIs to maintain.
2. **The CSS sits on top of Orca's variables** (`src/panel/panel.css`).
   - State colours are custom properties:
     - `--state-progress: var(--orca-primary)`;
     - `--state-done`: `#166534` in light and `#3fb950` in dark (`#1f9d55` reached only 2.9:1 on its light pill);
     - `--state-idle: var(--orca-muted-foreground)`;
     - `--state-error: var(--orca-destructive)`.

     The `done` green is picked per `html.light` and `html.dark` so pill text stays at 4.5:1 or
     better. That ratio is checked with a small contrast assert in `state.test.ts`, which tests
     the hex pair against the default Orca backgrounds.
   - Card: `background: var(--orca-card)`, a 1px `--orca-border` and `border-radius:
     var(--orca-radius)`, plus `border-left: 3px solid var(--state)`.
   - Pill: the state colour at 15% alpha (`color-mix`) behind state-coloured text.
   - Bar: a 4px track in `--orca-muted`. The fill is `hsl(var(--hue) 72% 42%)` (55% lightness in
     dark), with `--hue` from `progressHue()`: 0 (red) at 0% to 120 (green) at 100%. The count
     beside it stays in the foreground colour so it always reads.
   - A `done` card gets `color-mix(in srgb, var(--state-done) 6%, var(--orca-card))`.
   - Focus: `outline: 2px solid var(--orca-ring)`.

   Alternative considered: hard-coded palettes per theme like Fleet Monitor's. Rejected because
   it breaks with custom Orca themes. Only `done` needs its own colour.
3. **Recency comes from the worker.** `readChanges` adds `updatedAt`, the newest `mtimeMs` among
   the files of the change folder (recursive, with the same depth the reader already walks). The
   panel sorts by it and refreshes the relative text every 60 seconds with one timer.
4. **Next step without calling the openspec CLI.**
   - While tasks.md is missing, the next step is `Continue: <first missing of proposal, specs,
     design, tasks>`.
   - With tasks.md, it is `Apply` for `not-started` and `in-progress`, and `Archive` for `done`.

   Reading the artifacts on disk is what the panel already does. Running `openspec status` for
   each change would cost one process per card on every refresh.

   Trade-off: if a schema skips design, the stepper still shows design as missing, but the next
   step moves on once tasks.md exists.
5. **Four icon buttons, the next step filled.** `actionButtons()` gives continue, apply, verify
   and archive with the primary one marked. Each is a 28×24 icon button with an `aria-label` and
   a `title`; disabled ones get `disabled` and a `title` saying why. A `⋯` menu was tried first and
   dropped: the person preferred every action one press away. Tasks in the detail view show a
   checkbox icon, filled green when done.
6. **Header.** It is a 2×2 grid:
   - the icon tile: 20px, `border-radius: calc(var(--orca-radius) - 2px)`, background
     `--orca-primary` and an inline `layers` SVG in `--orca-primary-foreground`;
   - the name in 13px semibold, with the version beside it in `--orca-font-mono` 11px muted;
   - the subtitle below in 12px `--orca-muted-foreground`, truncated with an ellipsis;
   - the icon buttons on the right, ghost style and 24px.

   The version comes from fetching `/orca-plugin.json` (the frame origin is the plugin folder), read
   once. If that fails, the version is not shown. The `+` and Explore buttons replace the old start
   row, so the list begins right after the strip. A `1px --orca-border` line closes the header.
   Alternative: hard-coding the version in the panel, rejected because it drifts on each release.
7. **Filter and selection state.** The filter is in memory and resets on a workspace switch. The
   selected change is kept per workspace in `orca.storage`, under the key
   `selected:<workspaceId>`, from `workspace.changed`. This replaces the components
   `persist: 'workspace'` atom.
8. **Status bar driven by the worker.**
   - After every `listChanges()`, the worker sends `statusBar.update` with
     `statusBarSummary(result)`, skipping it when the summary equals the last one sent.
   - `listChanges()` runs on activation, on a new `workspace.changed` handler (through
     `contributes.events`) and on the watcher's debounce, which still posts `changes.changed`.
   - The item has `command: "openspec-pulse.showPanel"`. Its handler resolves the plugin key and
     runs `orca plugin open <key> --panel changes` with `execFile`, using `resolveOrcaCli` and
     `cliError` from today's code.
   - To find the key, the worker runs `orca plugin list --json` and takes the running entry whose
     key ends in `.openspec-pulse`, preferring `local.openspec-pulse`.

## Risks / Trade-offs

- [The rewrite loses the components test kit, so panel regressions go unseen by `npm test`] → the
  logic lives in `src/state.ts`, which has unit tests. The DOM layer stays thin. `orca plugin
  shot` runs in light and dark for the list, detail, empty and no-OpenSpec views, and each shot is
  inspected before merge.
- [Accessibility is now ours] → the keyboard and screen-reader requirement in
  `change-state-display` is checked by hand: tab through, with VoiceOver on one card.
- [Orca asks to approve the plugin again] → this is expected (new events, commands, status bar
  and panel kind). It goes in the README and is done with `orca plugin dev load . --approve`.
- [`color-mix` needs Chromium 111 or later] → Orca's Electron is far newer, so there is no
  fallback.
- [The theme's primary colour may be close to the `done` green in some themes] → the pill text
  still names the state, so the state never depends on colour alone.
- [The worker now always runs while the plugin is enabled] → it already holds one `fs.watch`. The
  only new work is a `statusBar.update` when the summary changes.

## Migration Plan

No stored data migrates. The components `selected` atom is dropped, so the first open after the
update shows the list. Rollback is reverting the commits and approving the plugin again.
