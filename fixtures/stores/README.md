# Shared stores fixtures

`list.json` follows the locally observed OpenSpec 1.14.1 `store list --json`
contract. Paths are placeholders, not real registrations. `workspace/` contains
a store pointer with unrelated YAML keys, a block scalar and comments.

`src/stores.test.ts` creates temporary workspaces and stores, injects CLI replies
and mounts a simulated Orca host. It never edits the real registry, invokes an
agent, queries external accounts or publishes a repository.

Manual CLI contract check on 2026-11-27: OpenSpec 1.14.1, macOS, temporary
`XDG_DATA_HOME` and `XDG_CONFIG_HOME`; `store setup <id> --path <new-folder>
--no-init-git --json`, `store list --json`, and `list --json --store <id>`.
Setup reported `git.initialized: false`, `git.committed: false`; list returned
`stores: [{ id, root }]` and `status: []`; root selection returned
`root: { path, source: "store", store_id }`. Temporary files were removed.

UI preview: `/panel?view=board&scenario=stores-shared&theme=light` (or `dark`).
Additional scenarios: `stores-incompatible`, `stores-error`, `stores-local`.
The preview records requests in `window.previewStoreCalls` and performs no writes.

Code and fixtures are original to this project. No external implementation was
copied or adapted; CLI help and JSON shapes were inspected as interface contracts.
