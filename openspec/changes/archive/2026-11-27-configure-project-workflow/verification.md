# Verification — configure-project-workflow

Verified 27/11/2026. All 10 tasks completed; change stays active, pending archive.

## Acceptance

- Optional `openspec/pulse.json`, version 1, with an actual bounded 64 KiB read. Invalid JSON,
  unknown keys/actions, incorrect types, unsupported artifacts and malformed/unknown placeholders
  reject the whole configuration, show an error and restore profile/task defaults.
- Required artifacts are calculated by the existing change reader. Missing artifacts override
  completed tasks to Drafting, appear on cards and select Continue as the primary action.
  When present, existing task classification applies. Archive history is unaffected.
- Literal prefixes extract the first matching continuation paragraph from the same tasks read.
  Fenced examples are ignored. Detail renders text with preserved newlines, never an agent action.
- Optional templates use bounded placeholder names by action and do not invoke a shell.
  The existing command builder is shared by preview and worker; task-only instructions remain.
- Exact effective project commands require explicit local acceptance. Versioned plugin storage
  binds consent to workspace id, canonical workspace/OpenSpec roots, raw file digest and command.
  Changed configuration, prompt/task content or workspace cannot reuse another command's consent.
  Unknown local storage fields are retained; no credentials or preferences are written to the project.
- Worker revalidates configuration, roots, focus, task identity and session availability before
  delivery, retaining the existing single-send guard. The OpenSpec watcher invalidates config edits.

## Checks

- `npm run typecheck`: passed.
- `npm test`: 89 tests passed across 11 files. New config tests cover missing/invalid config,
  exact size boundary, unknown keys/placeholders, literal prefixes, completed tasks with missing
  artifacts, present artifacts, template expansion and profile fallback. Mock-host tests cover
  consent persistence, changed config during destination lookup, workspace/root changes and watcher
  refresh, alongside existing task/session/double-send regression tests.
- `npm run validate`: passed; manifest capabilities and Orca minimum remain unchanged.
- `openspec validate configure-project-workflow --strict`: passed.
- `git diff --check`: passed.

## UI review

Used the shipping panel modules through `scripts/media-preview.mjs` with simulated data only.
Reviewed light/dark `workflow` scenarios: Drafting explanation, continuation paragraph, effective
workflow, exact command and unchecked local consent. Send starts disabled; Tab to the checkbox
and Space enable Send without dispatching. Tab/Enter deliver exactly one mock request containing
its fingerprint and command. Escape closes and restores focus to the originating action.
No horizontal overflow observed. Screenshots are local in `.playwright-mcp/`.

`workflow-error` shows the placeholder error and default Codex command without project consent.
`workflow-empty` shows the no-tasks state with the missing artifact explanation. No real prompts,
project writes outside fixtures/temp directories, external accounts or agent sessions were used.

## Compatibility and rollback

Dependency `configure-agent-commands` is archived and implemented. Uses existing `storage:own`,
agent discovery and terminal delivery APIs on Orca >=1.4.259, plus trusted-worker filesystem reads.
No manifest or permission changes. Removing feature code leaves project JSON and local metadata
in place. Implementation is original; no external code or new dependency/license obligations.
README and isolated `fixtures/workflow` document configuration, permissions and rollback.
