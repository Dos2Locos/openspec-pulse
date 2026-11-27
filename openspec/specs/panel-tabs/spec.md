# panel-tabs Specification

## Purpose

Lets the user switch the OpenSpec panel between the active changes, the archived changes and the
workspace's specs, and see at a glance how many of each there are.

## Requirements

### Requirement: Tabs for active, archive and specs
When the focused workspace has `openspec/changes/`, the panel SHALL show three tabs under its
header, `Active`, `Archive` and `Specs`, each followed by its count. `Active` SHALL be selected
first and show the active list as before. Without readable OpenSpec the tabs SHALL be hidden.

#### Scenario: Counts
- **WHEN** a workspace has 2 active changes, 5 archived changes and 3 specs
- **THEN** the tabs read `Active 2`, `Archive 5` and `Specs 3`, with `Active` selected

#### Scenario: No OpenSpec
- **WHEN** the workspace has no `openspec/changes/`, or is remote
- **THEN** no tabs are shown

### Requirement: Switching tabs
Pressing a tab SHALL show its list in place of the current one and mark it selected. The summary
strip and its filter SHALL belong to `Active` only. A workspace switch SHALL return to `Active`.

#### Scenario: Open the archive
- **WHEN** the user presses `Archive`
- **THEN** the archive list is shown, `Archive` is marked selected and the summary strip is hidden

#### Scenario: Workspace switch
- **WHEN** the `Specs` tab is selected and the user switches workspace
- **THEN** the panel shows the new workspace's `Active` tab

### Requirement: Tabs follow the files
The tab counts and lists SHALL refresh on a workspace switch, when files under the workspace's
`openspec/` change, and on Refresh.

#### Scenario: Change archived
- **WHEN** an active change is moved into `openspec/changes/archive/`
- **THEN** `Active` drops by one and `Archive` grows by one without pressing Refresh

### Requirement: Tabs are usable by keyboard and screen reader
The tabs SHALL be reachable with Tab, work with Enter or Space, and expose which one is selected.

#### Scenario: Keyboard
- **WHEN** the user tabs to `Specs` and presses Space
- **THEN** the specs list is shown and `Specs` is announced as selected
