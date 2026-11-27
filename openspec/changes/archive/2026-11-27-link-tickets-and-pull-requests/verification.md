# Verification — link-tickets-and-pull-requests

Verified 27/11/2026. Implemented against configure-project-workflow, whose 10 tasks are complete.
Tracked tasks complete; change remains active for review before archiving. No publication/tag.

## Acceptance

- Reuses readWorkflow/pulse.json validation and readWorkspace checks. Optional ticket prefixes
  are literal, case insensitive, start anchored and delimited; PR titles use full ticket boundaries.
  Templates are HTTPS with one non-host placeholder and no credentials. Repositories are explicit,
  unique and bounded. Foreign, credential-bearing or malformed PR links are excluded/rejected.
- Account selection is explicit, versioned local plugin storage keyed by canonical Git common
  directory or canonical local workspace fallback. Pulse origin/config enforces temperatio. No
  token is versioned or saved; unknown local metadata survives preference writes and rollback.
- gh is resolved outside the workspace and called with argument arrays, time/output bounds and
  no shell. Explicit user credential resolution clears ambient token variables; API user identity
  is checked before any PR query. Mismatch stops without changing/falling back to another account.
  Tests inject simulated CLI responses; no external account or network queries were performed.
- Requests contain at most six known active change names; three jobs maximum, coalesced identical
  requests, 5-minute successful cache, 60-second failure cooldown. Each key includes canonical
  roots, configuration fingerprint, expected login, ticket and repositories. Cache is memory-only,
  capped at 512 keys; restart/eviction removes last-good data, documented in README.
- Failures preserve last success, timestamp and Stale; no last success yields Unknown. Successful
  empty results alone yield No PRs. At the 100-result cap, incomplete data yields Unknown/Stale.
  gh unavailable, absent/wrong account, network/rate limit leave local task reading operational.
- Worker rechecks focus, canonical project/OpenSpec roots, configuration and saved account before
  CLI calls and returning snapshots; invalidated work is discarded. Preference saves reject stale
  project/workspace identity and serialize concurrent saves. Sibling reads use the existing same-Git
  identity checks. Panel discards obsolete generations and requests only rendered cards/detail.
- Task progress, local state, status bar and task/archive files stay independent of GitHub evidence.
  Open PR plus 100% stays In review; merged with pending/unknown tasks shows the discrepancy.
  No automatic task completion, archival, PR/ticket mutation or real agent delivery was introduced.

## Checks

- npm run typecheck: passed.
- npm test: 99 passed across 12 files, zero skipped/failed. Seven delivery unit/service tests and
  three mock-host delivery tests cover validation, boundaries/foreign repos, identity mismatch,
  missing gh/account/network, rate-limit failures, cache expiry/coalescing/cooldown, stale data,
  concurrency limit, batch limits, preference preservation, focus/config changes and read-only tasks.
- npm run validate: passed. Existing trusted-worker, storage:own and Orca >=1.4.259 suffice;
  no new manifest host APIs/capabilities or engine requirement, and no host activation performed.
- openspec validate link-tickets-and-pull-requests --strict: passed.
- git diff --check: passed.

## UI review

Shipping panel modules served by scripts/media-preview.mjs with simulated responses only.
Reviewed light/dark screenshots at desktop and 390px sidebar width; no horizontal overflow.
Scenarios delivery, delivery-empty, delivery-unknown and delivery-merged verify task counters
alongside In review, Merged with tasks pending, Merged, No PRs and Unknown; stale data retains
its links, reason and timestamp. The 7/7 sample card remains In review with an open PR.

Keyboard Enter opens account preferences; input, Tab and Enter save the mock login. Save restores
focus to its button across asynchronous redraws. Tab from ticket moves to the PR link; links have
accessible names and noopener/noreferrer. All worktrees shows eight cards with eight delivery
regions and separate origin identities. No application errors were shown; a browser autofill
extension reported its own detached-node error during form redraw (outside the panel source).

## Integration and rollback

README, CHANGELOG and fixtures/delivery document configuration, local preferences, credential use,
read-only queries, cache/limits, failure states and rollback. No external source, dependency or
license obligation was introduced. Remove optional keys to hide delivery; clear local login to
disable queries. Reverting code leaves config/preferences intact; older versions reject unfamiliar
project keys and use defaults. Proposal index records implementation beside the task changes.

The workspace already contained uncommitted work for earlier proposals; it was retained. This
change is left uncommitted alongside it, without archiving or publishing.
