# Tasks

## 1. Readers and worker

- [x] 1.1 Add `readArchive`, `readArchivedDetail`, `readSpecList`, `countArchive` and `countSpecs` to `src/openspec.ts` (design decision 1); verify in `src/openspec.test.ts`: dated and undated folders in order, `name` and `date`, final `done/total`, a nested spec path, a spec without Purpose, requirement counts, and `null` for `../x` and unlisted folders (`npm test`)
- [x] 1.2 Extend `src/protocol.ts` and `src/worker.ts` with the counts on `changes.list`, `archive.list`, `archive.detail`, `specs.list`, `specs.open` and `changes.open` with `archived: true`, and move the watcher to `openspec/`; verify in `src/worker.test.ts` that the counts are returned, that `specs.open` and archived `changes.open` call `editor.open` with the right path, and that `../` names are refused without any `editor.open` (`npm test`)

## 2. Panel

- [x] 2.1 Add the tab bar under the header (`role="tablist"`, `aria-selected`, counts) shown only with OpenSpec, with the strip and filter only under `Active` and a reset to `Active` on workspace switch; verify in the browser harness and in Orca with `orca plugin shot local.openspec-pulse` in both themes
- [x] 2.2 Build the Archive tab (rows with name, date and `done/total`, `No archived changes`) and the read-only detail (`Archived <date>` pill, muted stripe, no action row, files that open in the editor); verify by opening an archived change of `/private/tmp/openspec-pulse-states` and one of its files in Orca
- [x] 2.3 Build the Specs tab (capability, purpose, `N requirements`, `No specs yet`) with rows that open the spec in the editor; verify after archiving `redesign-panel-with-state-colors`, whose three specs must appear, and by opening one
- [x] 2.4 Verify the tabs refresh by themselves: archive a change in `/private/tmp/openspec-pulse-states` by moving its folder and check that `Active` and `Archive` counts change without Refresh; then tab through the tab bar and press Space on `Specs`

## 3. Docs

- [x] 3.1 Describe the tabs, the archive and the specs in `README.md` (panel section, How it works table) and refresh `media/panel-light.png` and `media/panel-dark.png` if the header changes; verify the README file table matches `git ls-files src`
