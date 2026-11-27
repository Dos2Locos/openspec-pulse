# Verification — add-main-area-board

Date: 2026-11-27. Implementation is original; no new dependencies or third-party source.
User authorized a local Git-ignored workspace marker instead of private plugin storage.

## Automated checks

- `npm run typecheck`: passed.
- `npm test`: 108 passed in 13 test files, no failures/skips.
- `npm run validate`: passed; capabilities unchanged, Orca >=1.4.259.
- `orca plugin check . --json`: editor entry and its import graph have no issues/warnings.
- `openspec validate add-main-area-board --strict`: passed.
- `git diff --check`: passed.

## Acceptance evidence

| Requirement/scenario | Evidence |
| --- | --- |
| Open board without replacing panel | Manifest contributes an isolated `.pulse-board` editor and palette command; panel header calls the same `board.open` handler. Mock host verifies `editor.open` receives workspace ID and relative marker path. |
| Same progress in both surfaces | Both use `src/panel/surface.ts`, the same typed requests and `changes.changed`. Worker test performs simultaneous browse reads before/after a real fixture edit and verifies equal snapshots and completed count. Read requests no longer invalidate each other; an older status read cannot replace the newer file watcher. |
| Inert active Markdown | Pure tests preserve script/img content as text. Browser checks in board and panel verify visible raw markup, no script/img DOM nodes, no executed payload, and only HTTP(S) links actionable. |
| Back, filters and focus | Browser fixture filtered to `team`, opened a card, previewed an artifact, then escaped twice. Filter and origin focus were preserved. Real Orca keypress Enter opened detail with Back focused; Escape restored the source card. |
| Shared sidebar preview | `view=detail` renders the same reader/render module without opening a board. Open in editor remains present, including preview errors. |
| Read-only paginated archive | `board-many` begins folded; opening shows 40 rows, then 80, then 85. Archived detail has no agent/task execution controls. |
| Sibling restriction | Browser selects the sibling, opens detail and reads Markdown with no run/task actions. Existing worker tests also reject forged/sibling action identities. |
| Archive cancellation/confirmation | Browser command sheet shows workspace ID, agent/destination, dated archive folder, exact command and 3 pending tasks. Cancel leaves the mock send list empty. Explicit Send clicked twice records exactly one archive request. No real prompts were delivered. |
| Workspace change/errors | Artifact error keeps editor alternative. Changing the mocked workspace disables the board; a later file event cannot reactivate it. Worker tests reject a workspace switch during marker opening/artifact reads. |
| Marker safety/rollback | Mock-host tests reject an unignored marker, another workspace, unknown versions and symbolic directories; unknown metadata remains intact. One concurrent open succeeds. Reader tests reject unlisted/escaped paths, symlink artifacts and oversized previews. Disabling the contribution leaves files intact. |

## Visual review and reproduction

Used Orca CLI browser against the shipping UI modules served by `npm run media:preview`,
with the isolated fixture host. Inspected light board columns and dark board/detail previews,
including independent GitHub delivery. Preview buttons use theme-aware secondary/ghost styles.
See `fixtures/board/README.md` for scenario URLs and reproduction steps.

No development plugin was installed/reapproved, no external account was queried, and no agent
was launched during this verification. Main-app integration is covered by typed host mocks and
Orca's static editor checker; live plugin activation still uses Orca's normal approval flow.

Implementation is ready for review and archive. No archive, release, tag or publication was made.


## Real-host follow-up: blank editor (2026-11-27)

The user reported a blank editor. Real Orca logs showed the board importing the panel entry URL,
which Orca serves as HTML, causing a strict module MIME error. The shared controller now lives
in `src/panel/surface.ts`; both contribution entries import that module by value. Neither imports
another contribution entry. Startup failures also render an explicit error.

The real custom editor did not replay the initial `workspace.changed` event. Startup now reads
`workspace.readContext` after subscribing, while preserving any newer event. The fixture host
supports that read and includes `board-no-replay` to reproduce the actual host behavior.

Reloaded the already-approved development plugin, closed the stale marker tab and reopened it.
`orca plugin shot --editor .orca/openspec.pulse-board` confirms document subscription with no
frame errors. A subsequent computer-use accessibility read and screenshot confirm state columns,
3 actual project changes, progress and the simultaneously available sidebar. The shot alone
captures the initial Loading frame, so it is not used as evidence that data finished loading.
The browser `board-no-replay` scenario renders 4 columns and 4 fixture cards without an initial
event. No real agent command was sent.

During regression verification, an older deactivated worker's asynchronous startup could replace
the active test worker's file watcher. Watcher installation is now bound to the worker activation;
fixtures are prepared before mounting the concurrency test. All 108 tests and typecheck pass.
Manifest/static editor and strict OpenSpec validation also pass after the correction.
