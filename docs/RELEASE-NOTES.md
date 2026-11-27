# OpenSpec Pulse 0.2.0

## Your OpenSpec workflow, in the sidebar and on the board

OpenSpec Pulse brings active proposals, task progress, archived changes and shared specs into
Orca. This release adds a main-area board while keeping the compact sidebar available.

- **Stay focused:** Active, Archive, Specs, Stores and Spend each have a dedicated tab,
  shared by sidebar and board, with navigation state and pending store previews preserved.
- **Follow your language:** the interface matches Orca in English, Spanish (Spain) or
  Simplified Chinese, with regional dates/numbers/USD and keyboard-accessible narrow layouts.
- **Review local usage:** automatic Claude Code/Codex tokens and estimated API-equivalent USD
  by agent, model and month. Coverage, unknown pricing and stale results remain explicit;
  optional project run records are shown separately.
- **Find and organize work:** search and paginated lists, dependency order with cycle warnings,
  local favorites, and links between specs and related proposals.
- **Choose how to act:** Claude Code or Codex profiles, explicit destinations and a reviewed
  prompt before sending; run a whole change or one pending task.
- **See the right context:** registered sibling worktrees and shared OpenSpec stores with
  explicit system scopes. Agent execution stays limited to the focused local workspace.
- **Adapt to your project:** optional `openspec/pulse.json` workflow settings, ticket links
  and GitHub PR delivery signals kept separate from checkbox progress.
- **Read without leaving the view:** safe Markdown artifact previews, light/dark themes and
  a status-bar summary of the focused workspace.

## Compatibility and optional integrations

Requires **Orca desktop 1.4.259+** and local workspaces. The board requires Git and an ignored
`.orca/openspec.pulse-board` path. Shared stores require the tested **OpenSpec CLI 1.14.1**
contract on macOS. Ordinary local browsing needs no OpenSpec CLI. Agent actions require the
chosen agent and its OpenSpec skills; GitHub delivery requires GitHub CLI and an explicitly
selected account. SSH/WSL workspaces remain unsupported. Automatic usage reads local session
usage metadata for selected workspaces; estimated API costs are not subscription charges or
invoices, and are not attributed to tasks or shared-store system prefixes.

This is a trusted-worker plugin with access under the current user's account. Orca shows the
access request before approval and may ask again when its fingerprint changes. Pulse has no
analytics or telemetry; automatic usage does not interpret conversation content or read account
credentials; optional GitHub queries and configured agent services use their own
accounts. See [access and privacy](https://github.com/Dos2Locos/openspec-pulse/blob/v0.2.0/README.md#access-and-privacy).

## Thanks

Thanks to **cmdaltctr**, **Ilya Bazylchuk (IBazylchuk)** and **jameslatajan** for their OpenSpec
plugins and the ideas that informed Pulse. See the [acknowledgements](https://github.com/Dos2Locos/openspec-pulse/blob/v0.2.0/ACKNOWLEDGEMENTS.md)
for project links, reviewed revisions and licenses.

Install through Orca from `Dos2Locos/openspec-pulse`. See the [README](https://github.com/Dos2Locos/openspec-pulse/blob/v0.2.0/README.md) for setup
and the [usage guide](https://github.com/Dos2Locos/openspec-pulse/blob/v0.2.0/docs/USAGE.md) for configuration and limits.
