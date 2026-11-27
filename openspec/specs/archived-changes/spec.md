# archived-changes Specification

## Purpose

Shows the changes that were archived in the focused workspace, newest first, and lets the user read
any of them without being able to act on it.

## Requirements

### Requirement: Archive list
The `Archive` tab SHALL list every folder under `openspec/changes/archive/`, newest first. Each row
SHALL show the change name, its archive date, and its final `done/total`, or `no tasks`.

#### Scenario: Dated folder
- **WHEN** the archive holds `2026-11-26-add-x` with tasks.md at 4/5
- **THEN** its row reads `add-x`, `26 Nov 2026` and `4/5`

#### Scenario: Order
- **WHEN** the archive holds `2026-01-01-old` and `2026-11-26-new`
- **THEN** `new` is listed before `old`

#### Scenario: Folder without a date
- **WHEN** an archive folder name does not start with `YYYY-MM-DD-`
- **THEN** it is listed after the dated ones under its full folder name, with no date

#### Scenario: Empty archive
- **WHEN** `openspec/changes/archive/` is missing or empty
- **THEN** the tab shows `No archived changes`

### Requirement: Read-only archived change detail
Pressing an archived row SHALL show its detail: an `Archived <date>` pill, its artifacts and specs as
rows that open the file in Orca's editor, and its task sections with their bars and checkboxes. It
SHALL offer no agent action.

#### Scenario: Open an archived change
- **WHEN** the user presses `add-x` in the archive
- **THEN** the detail shows `Archived 26 Nov 2026`, its files and its tasks, and no continue, apply,
  verify or archive button

#### Scenario: Open a file
- **WHEN** the user presses `design.md` in an archived change's detail
- **THEN** `openspec/changes/archive/2026-11-26-add-x/design.md` opens in Orca's editor

### Requirement: Archive paths stay inside the archive
The plugin SHALL only read or open an archived change whose folder is listed under
`openspec/changes/archive/`, and only files that change lists.

#### Scenario: Name outside the archive
- **WHEN** the panel asks for the archived change `../add-y` or a file `../../secret`
- **THEN** nothing is read or opened
