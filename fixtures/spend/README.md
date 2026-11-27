# Recorded-spend fixtures

Synthetic project records only; no personal sessions, real accounts or credentials.

- Active log: declared cost, token-only event, known zero, malformed JSON and negative cost.
- Archive log: a prior month, separate task and model.
- Additional folder: duplicate ID, unknown date and a divergent ID conflict.

The pure aggregator is shared by production and the preview server. Run
`node scripts/media-preview.mjs` and open
`http://127.0.0.1:4177/panel?view=active&theme=light&scenario=spend`.
Use `theme=dark`, `view=board`, or scenarios `spend-empty`, `spend-tokens`,
`spend-zero`, `spend-error`, `spend-many`.
The preview models a filtered root: $0.37 declared in scope, one event without cost, and
$0.08 separately unattributed. It marks the folder truncated to exercise that diagnostic;
the on-disk fixture itself is small.

Automated filesystem tests create disposable temporary directories for oversized logs,
symlink escapes, hard links and shared-root/overlapping-scope deduplication.
Worker tests simulate the host and verify fresh reads, disabled configuration, stale focus,
configuration replacement, and two workspaces sharing one store without double-counting.
They launch no agents and query no external accounts.

Browser acceptance (2026-11-27): panel keyboard open, Tab, grouping and refresh focus;
20→40→all group pagination and focus fallback; empty, token-only, zero and excluded-path states;
360px light/dark screenshots; board workspace change clears old spend. All passed.

Automatic consumption is tested separately in `src/usage.test.ts` and the simulated worker host.
Preview scenarios: `usage`, `usage-empty`, `usage-unpriced`, `usage-error`,
`usage-truncated`, `usage-many`, `usage-delay`. They contain synthetic tokens, never personal
conversations. The normal preview estimates $0.0995 from Claude Sonnet 5.5 and GPT-6.2 Sol.
An enabled manual source without events or diagnostics is now hidden; the automatic section
provides its own empty state without requiring project configuration.

Automatic UI acceptance: light/dark at 360px, keyboard expansion and select focus, agent/model/month
groups, pagination and last-page focus, cache totals, catalogue date, unknown model, missing
sessions, failures, partial coverage, retaining the last result on error, and discarding delayed
results after a board workspace switch. Passed on 2026-11-27.
