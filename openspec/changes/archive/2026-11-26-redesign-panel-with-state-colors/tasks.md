# Tasks

## 1. State model

- [x] 1.1 Add `updatedAt` (newest file `mtimeMs` in the change folder) to `Change` in `src/protocol.ts` and `readChanges` in `src/openspec.ts`; verify `src/openspec.test.ts` asserts it equals the fixture's newest file time after a `utimes` (`npm test`)
- [x] 1.2 Add `src/state.ts` with `changeState`, `steps`, `nextStep`, `stateCounts`, `relativeAge` and `statusBarSummary` (design decisions 1, 4 and 8); verify with `src/state.test.ts` covering every scenario of `change-next-step`, the classification and strip-order scenarios of `change-state-display`, and the text, tone, tooltip `+N more` and hidden cases of `status-bar-summary` (`npm test`)
- [x] 1.3 Add the state colour pairs and a WCAG contrast helper to `src/state.ts`, read the default light and dark `--card` values from Orca's built-in theme, and verify in `src/state.test.ts` that each state's pill text reaches 4.5:1 on its pill in both themes

## 2. Status bar item

- [x] 2.1 In `orca-plugin.json`, declare the `summary` status bar item (`layers`, `command: openspec-pulse.showPanel`), the `openspec-pulse.showPanel` command and `events: ["workspace.changed"]`; verify `npm run validate` passes
- [x] 2.2 In `src/worker.ts`, send `statusBar.update` with `statusBarSummary` after each `listChanges()`, skipping repeats; call `listChanges()` on activation, on `workspace.changed` and on the watcher debounce (still posting `changes.changed`); verify in `src/worker.test.ts` with `host.callsOf('statusBar.update')`: a summary for a workspace with a change, `visible: false` without OpenSpec, and a new summary after a `workspace.changed` event
- [x] 2.3 Register `openspec-pulse.showPanel`: resolve the plugin key from `orca plugin list --json` (prefer `local.openspec-pulse`, else the running `*.openspec-pulse`) and run `orca plugin open <key> --panel changes` with `execFile`, logging failures; verify the key picker with unit tests for dev, installed and missing cases
- [x] 2.4 Reload the dev plugin (approve again), then verify by hand that the item shows `N changes · d/t` in `accent` on this repo, that pressing it opens the panel with the sidebar closed, and capture `orca plugin shot local.openspec-pulse --status-bar --theme dark` and `--theme light`
- [x] 2.5 Document the status bar item, its press and the re-approval in `README.md`; verify the commands quoted there run

## 3. html panel

- [x] 3.1 Switch the manifest panel to `"ui": "html"` with entry `src/panel/main.ts`; add `src/panel/dom.ts` (an `h()` helper that sets text only through `textContent`) and `src/panel/panel.css` on top of the `--orca-*` variables with the state custom properties (design decision 2); verify the panel loads empty with no errors in `orca plugin logs local.openspec-pulse`
- [x] 3.2 Build the plugin header (icon tile, name, version read from `/orca-plugin.json`, workspace subtitle, `+`/Explore/Refresh icon buttons; design decision 6), then port the summary strip with its filter (`aria-pressed`), the first-prompt form opened from `+` and Explore (Cmd+Enter submits) and the no-workspace, remote, no-OpenSpec (with Initialize) and empty states; verify each `Plugin header` scenario and each state by hand and with `orca plugin shot local.openspec-pulse --theme dark` and `--theme light`
- [x] 3.3 Build the change card: stripe, state pill, progress bar (`role="progressbar"` with `aria-valuenow`), `done/total`, stepper, `edited … ago` refreshed every 60 s, the four icon action buttons with the next step filled, the red-to-green bar, with the list sorted by `updatedAt`; verify against a workspace with one change per state (copy `fixtures/sample` and add a done change and a drafting one) in shots for both themes
- [x] 3.4 Build the detail view: header card, artifact and spec rows that call `changes.open`, task sections with their own bar and `done/total`, and expandable long tasks with `inline code`; keep the selected change per workspace in `orca.storage` (`selected:<workspaceId>`); verify by opening a change, switching workspace and back, and with a detail shot in both themes
- [x] 3.5 Follow `theme` events with no reload and check keyboard and screen reader use: tab order, Enter/Space, visible focus ring, VoiceOver reading one card's name, state, progress and primary action; verify by switching Orca's theme with the panel open and by doing the tab-through (VoiceOver replaced by the Chrome accessibility tree, agreed on 26/11/2026)
- [x] 3.6 Remove `src/panel.tsx`, `src/actions.tsx`, `src/panel.test.tsx` and `src/panel.check.ts`, and move what is still needed from `src/text.ts` into the panel; verify `npm run typecheck` and `npm test` pass and nothing imports the removed files
- [x] 3.7 Rewrite the panel parts of `README.md` (what each card shows, the colours, the action buttons, the "How it works" table and the html-panel verification with `orca plugin shot`) and add one light and one dark screenshot under `media/`; verify the README's file table matches `git ls-files src`

## 4. Integration

- [x] 4.1 Run `npm run typecheck`, `npm test` and `npm run validate`; then with the dev plugin loaded, tick a checkbox in this change's tasks.md with the panel closed and verify the status bar count changes, open the panel from the status bar and check that the card's bar, pill and next step moved too
- [x] 4.2 Press each action button once on a test change and verify the command each one sends matches today's (`/openspec-continue-change`, `-apply-change`, `-verify-change`, `-archive-change <name>`) in the receiving Claude Code terminal or chat
