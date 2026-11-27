# Proposal

## Why

The panel only shows active changes. Once a change is archived it disappears, and the specs it
leaves in `openspec/specs/` cannot be seen at all, so the panel answers "what is moving" but not
"what is done" or "what does the system promise". Both live next to the active changes on disk.

## What Changes

- **Tabs under the header**: `Active N · Archive N · Specs N`. Active is today's list, with its
  summary strip and filter. The tabs show only when the workspace has `openspec/changes/`.
- **Archive tab**: the folders under `openspec/changes/archive/`, newest first. Each row shows the
  change name, its archive date (from the `YYYY-MM-DD-` prefix), its artifacts and its final
  `done/total`.
- **Archived change detail** (read-only): the same detail as an active change (artifacts, specs,
  task sections with bars and checkboxes), with an `Archived <date>` pill and no agent buttons.
  Artifact and spec rows open the file in Orca's editor.
- **Specs tab**: the capabilities under `openspec/specs/`, sorted by name. Each row shows the
  capability, its purpose (first line of `## Purpose`) and how many requirements it has. Pressing
  a row opens its `spec.md` in Orca's editor.
- The tab, the list and the counts refresh like the active list: on workspace switch, on file
  changes under `openspec/` and on Refresh.

Out of scope:

- searching or filtering the archive or the specs;
- reading a spec inside the panel (it opens in the editor);
- unarchiving, or any agent action on archived changes;
- the status bar item, which keeps counting active changes only.

Depends on `redesign-panel-with-state-colors`, whose html panel this extends.

## Capabilities

### New Capabilities

- `panel-tabs`: switching the panel between active changes, the archive and the specs, with counts.
- `archived-changes`: listing archived changes and showing one read-only.
- `shared-specs`: listing the workspace's main specs and opening one.

### Modified Capabilities

None: `openspec/specs/` is still empty. The active list, its cards and the status bar keep the
behaviour `redesign-panel-with-state-colors` defines.

## Impact

- `src/openspec.ts`: readers for the archive and for `openspec/specs/`.
- `src/protocol.ts` and `src/worker.ts`: new requests for the archive list, an archived change's
  detail, the spec list, and opening their files; the watcher covers `openspec/` instead of only
  `openspec/changes/`.
- `src/panel/`: the tab bar, the archive and spec lists, and a read-only mode of the detail view.
- Tests for the new readers and for refusing names outside the archive or the specs.
- No new capabilities, dependencies or approvals.
