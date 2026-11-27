# Changelog

## Unreleased

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
