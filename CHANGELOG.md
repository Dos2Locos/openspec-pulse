# Changelog

## 0.2.1 — 2026-11-27

- Include all six reviewed screenshots in the tagged marketplace manifest, with board,
  dedicated Stores/Spend and Spanish/Simplified Chinese views leading the gallery.
- Add reproducible gallery layouts and updated README/publication documentation.
- No runtime behavior or permission changes from 0.2.0.

## 0.2.0 — 2026-11-27

- Separate Active, Archive, Specs, Stores and Spend into focused tabs shared by sidebar and
  board. Preserve list filters, ordering, pages and store previews across navigation; keep
  store repair available when OpenSpec cannot be read.
- Follow Orca's language with complete English, Spanish (Spain) and Simplified Chinese UI,
  localized dates/numbers/USD, accessible wrapping tabs and stable keyboard focus.
- Show automatic Claude Code/Codex usage from local workspace session metadata, with tokens
  and estimated API-equivalent USD by agent, model and month. Preserve coverage and unknown
  pricing; keep optional project JSONL run records separate from automatic usage. No
  subscription charges or task attribution are inferred.

- Refresh release documentation, separate the detailed usage manual from the README, and
  acknowledge cmdaltctr, Ilya Bazylchuk and jameslatajan with pinned license/provenance links.

- Browse registered shared OpenSpec stores with separate workspace/data-root identity and explicit
  system scopes. Revalidate roots and replace data watchers on relink. Preview/confirm link,
  unlink and local creation while preserving unrelated YAML keys/comments; create without Git or
  remote publication. Gate store operations on the tested OpenSpec 1.14.1 contract and keep shared
  changes read-only for agents.

- Open a workspace board in the main area with local-state columns, shared search/order/favorites,
  folded paginated archive and independent delivery signals. Preview safe Markdown artifacts in
  both board and sidebar; preserve keyboard return focus and confirm archive destination/pending
  tasks before delivery. The ignored local marker is workspace-bound and never replaces unknown data.

- Link configured ticket prefixes to HTTPS trackers and declared GitHub PRs. Delivery stays separate
  from checkbox progress, with explicit local account selection, effective-identity verification,
  bounded read-only queries, caching and visible Unknown/Stale states on failures.

- Configure the project workflow with optional validated `openspec/pulse.json`: required artifacts,
  literal continuation paragraphs and agent command templates. Missing required artifacts remain
  Drafting; project commands show their effective text and require local workspace consent that
  expires when the configuration or roots change. Invalid files visibly fall back to defaults.

- Browse this worktree, registered Git siblings or all of them across Active, Archive and Specs.
  Results retain their workspace and branch; file links open in that origin. Siblings are read-only
  for agent actions and initialization, and the status bar keeps the focused workspace's summary.
  The compact scope selector follows Orca's theme; discovery diagnostics start folded.

- Link specs to active and archived changes using complete capability paths. Change details show
  searchable, paginated related changes; spec rows open a detail with Open in editor. Back restores
  the source view and keyboard focus; file edits and archive moves invalidate the shared index.

- Choose dependency order or recently edited changes; recognize explicit ES/EN dependencies and
  optional manual priorities, with cycle, unknown-reference and invalid-order warnings. Local
  workspace favorites form a leading group and keep dependency warnings without editing project files.
  Dependency details start collapsed, with counts and warnings in a keyboard-accessible summary.

- Run a single pending task with the selected agent and destination. Tasks are revalidated against
  disk before delivery; stale selections and duplicate sends are refused, and progress continues
  to come only from `tasks.md`. Archive details remain read-only.

- Search Active and Archive by name and Specs by path or purpose (case and accent insensitive),
  combined with the state filter. Lists show 40 rows at a time with a Load more button; the
  search text is remembered per workspace and tab.
- Choose Claude Code or Codex (tested "skills" profiles; Claude stays the default). Codex uses
  `$openspec-*` skill invocations, not a text swap of the Claude commands.
- Every agent action now shows agent, destination and command in a sheet before it is sent.
- Pick the destination: automatic (as before), a new session, or an idle session of the workspace.
  Busy, asking, blocked, changed or rejected destinations are errors; nothing falls back silently.
- Optional model for new Claude sessions. Agent and model are remembered per workspace.

## 0.1.0

Initial release, prepared for publication.

- Active OpenSpec changes with state filters, task progress and next-step actions.
- Change details with artifacts, capability specs and tasks grouped by section.
- Archived changes and shared specs in dedicated tabs.
- Live refresh and a workspace summary in Orca's status bar.
- OpenSpec initialization, new proposals and exploration from the panel.
- Claude Code actions for continuing, applying, verifying and archiving a change.
- Light and dark theme support.

Requires Orca desktop 1.4.259 or later and a local workspace. Agent actions require Claude Code
and the OpenSpec skills; initialization requires the OpenSpec CLI.
