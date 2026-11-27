# Design

## Context

- The html panel from `redesign-panel-with-state-colors` has one view: the active list, plus the
  detail of an active change. Its state lives in `src/panel/main.ts`; views are plain functions in
  `src/panel/views.ts` and `src/panel/detail.ts`.
- The worker reads `openspec/changes/` (`src/openspec.ts`), skips `archive/`, and only reads or
  opens a change whose folder it has just listed (`readChangeDetail`, `openableFiles`). Every new
  read follows that rule.
- The watcher covers `openspec/changes/` only, so edits to `openspec/specs/` go unseen.
- OpenSpec names archive folders `YYYY-MM-DD-<change>`. Main specs live at
  `openspec/specs/<capability-path>/spec.md`, where the path may be nested (`identity/user-auth`).

## Goals / Non-Goals

**Goals:**
- Reuse the active change's reader and detail view for archived changes rather than a second copy.
- Keep the first load as cheap as today: the tab counts come with `changes.list`; the archive and
  spec lists are read only when their tab opens.

**Non-Goals:**
- No caching of the archive between refreshes; it is re-read like the active list.
- No persistence of the selected tab or of an open archived change across workspace switches.

## Decisions

1. **Readers in `src/openspec.ts`.**
   - `readArchive(root)`: each folder under `openspec/changes/archive/` through the existing
     `readChange`, plus `folder`, `name` (the folder without its date prefix) and `date`
     (`YYYY-MM-DD` or null). Sorted by folder name descending, so dated folders come newest first;
     undated ones go after them.
   - `readArchivedDetail(root, folder)`: `readChangeDetail` with the archive as the changes folder,
     after checking `folder` is one `readArchive` listed.
   - `readSpecList(root)`: walks `openspec/specs/` up to 3 levels for `spec.md` files. For each it
     returns `capability` (the relative folder path), `purpose` (first non-empty line after
     `## Purpose`, or null) and `requirements` (count of `### Requirement:` lines). Sorted by
     capability.
   - Counts for the tabs: `countArchive` and `countSpecs` only list folders, without reading files.

   Alternative: run `openspec list --specs --json` and `openspec show`. Rejected: one process per
   refresh, and the panel already reads OpenSpec's files directly.
2. **Protocol** (`src/protocol.ts`):
   - the `ok` state of `changes.list` gains `archived: number` and `specs: number`;
   - new requests `archive.list`, `archive.detail` (`{ folder }`), `specs.list` and `specs.open`
     (`{ capability }`);
   - `changes.open` gains an optional `archived: true`, which resolves `name` against the archive.

   Every name or path from the panel is looked up in a fresh listing before use, as today.
3. **Watcher on `openspec/`.** The watched folder moves from `openspec/changes/` to `openspec/`
   (recursive), so archive moves and spec edits post `changes.changed`. The status bar keeps using
   active changes only.
4. **Panel state.** `tab: 'active' | 'archive' | 'specs'`, reset to `active` on a workspace switch.
   The archive and spec lists are loaded when their tab opens and on each `changes.changed` while
   it is open. An archived detail is `selected: { kind: 'archived', folder }`; it is not stored in
   `orca.storage`, so only active selections survive a workspace switch.
5. **Tab bar.** A `role="tablist"` of three buttons with `role="tab"` and `aria-selected`, styled
   like the summary strip's items (pill, 12px). All three are in the Tab order and respond to Enter
   and Space as native buttons; arrow-key roving is left out to keep them plain buttons.
6. **Read-only detail.** `detailView` takes the archived change and drops the action row. The card
   uses the muted stripe and an `Archived 26 Nov 2026` pill; the bars keep their red-to-green fill.
   Dates are formatted with fixed English month abbreviations, like the rest of the panel's text.
7. **Rows.** Archive rows are buttons with the name, the date and `done/total` (the count in the
   foreground colour, no bar, to keep a long archive compact). Spec rows are buttons with the
   capability in semibold, the purpose muted and truncated to one line, and `N requirements`.

## Risks / Trade-offs

- [A large archive (hundreds of changes) makes the Archive tab slow to open] → each row reads one
  tasks.md, a few KB; the list is read only when the tab opens. If it becomes slow, read counts
  lazily per visible row.
- [Watching `openspec/` also fires on `openspec/config.yaml` edits] → harmless: a refresh.
- [Nested spec paths deeper than 3 levels are not listed] → OpenSpec projects use one or two
  levels; the limit stops a runaway walk.
- [A folder in the archive without a date prefix] → listed after the dated ones under its full name.

## Migration Plan

No stored data changes. Rollback is reverting the commits; no new approval is needed because no
capability, command, event or status bar item is added.
