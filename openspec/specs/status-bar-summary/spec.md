# status-bar-summary Specification

## Purpose

Shows the OpenSpec state of the focused workspace in Orca's status bar, so progress is visible at a
glance without opening the panel.

## Requirements

### Requirement: Status bar item summarises the focused workspace
The plugin SHALL contribute one status bar item with the `layers` icon. While the focused workspace
is local and has `openspec/changes/`, its text SHALL be the number of active changes and the sum of
done and total tasks across them, such as `2 changes · 5/12`.

#### Scenario: Workspace with active changes and tasks
- **WHEN** the focused workspace has the changes `a` (3/7 tasks) and `b` (2/5 tasks)
- **THEN** the item reads `2 changes · 5/12`

#### Scenario: One change
- **WHEN** the focused workspace has one active change with 1/4 tasks
- **THEN** the item reads `1 change · 1/4`

#### Scenario: Changes without tasks
- **WHEN** no active change has a tasks.md with checkboxes
- **THEN** the item reads only the change count, such as `2 changes`

#### Scenario: No active changes
- **WHEN** `openspec/changes/` holds only the archive
- **THEN** the item reads `No changes`

### Requirement: Status bar tone reflects progress
The item's tone SHALL be `accent` while at least one task of an active change is pending, `success`
when the active changes have tasks and all are done, and `neutral` otherwise. It SHALL never use
`warning` or `danger`.

#### Scenario: Pending tasks
- **WHEN** the active changes total 5/12 tasks
- **THEN** the item tone is `accent`

#### Scenario: Everything done
- **WHEN** the active changes total 12/12 tasks
- **THEN** the item tone is `success`

#### Scenario: Nothing to count
- **WHEN** there are no active changes, or none has tasks
- **THEN** the item tone is `neutral`

### Requirement: Status bar tooltip lists the changes
The item's tooltip SHALL name the workspace and list each active change with its `done/total`, or
`no tasks`, one per line, within Orca's 256-character tooltip limit.

#### Scenario: Tooltip content
- **WHEN** the workspace `repo` has `add-x` (1/2) and `fix-y` without tasks.md
- **THEN** the tooltip reads `OpenSpec · repo`, then `add-x 1/2`, then `fix-y no tasks`

#### Scenario: Too many changes for the limit
- **WHEN** the list would exceed 256 characters
- **THEN** the tooltip ends with `+N more` instead of cutting a line

### Requirement: Status bar item hides without readable OpenSpec
The item SHALL be hidden when no workspace is focused, when the focused workspace is remote, and
when it has no `openspec/changes/` folder.

#### Scenario: Workspace without OpenSpec
- **WHEN** the user focuses a workspace without `openspec/changes/`
- **THEN** the status bar item is not shown

#### Scenario: Remote workspace
- **WHEN** the focused workspace is on SSH or WSL
- **THEN** the status bar item is not shown

### Requirement: Pressing the status bar item opens the panel
Pressing the item SHALL show the OpenSpec Pulse panel in Orca's right sidebar, opening the sidebar
when it is closed. If the panel cannot be opened, the plugin SHALL log why and change nothing else.

#### Scenario: Sidebar closed
- **WHEN** the right sidebar is closed and the user presses the item
- **THEN** the sidebar opens on the OpenSpec Pulse panel

#### Scenario: Another panel shown
- **WHEN** the right sidebar shows another plugin's panel and the user presses the item
- **THEN** the sidebar switches to the OpenSpec Pulse panel

### Requirement: Status bar item stays current without the panel
The item SHALL update when the focused workspace changes and when files under its
`openspec/changes/` change, whether or not the OpenSpec panel is open.

#### Scenario: Workspace switch with the panel closed
- **WHEN** the panel is closed and the user switches to another workspace with OpenSpec
- **THEN** the item shows that workspace's summary

#### Scenario: Task ticked in tasks.md
- **WHEN** a checkbox in a watched change's tasks.md is marked done
- **THEN** the item's count and tone update without pressing refresh
