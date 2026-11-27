# Spec Delta

## Purpose

Gives each active change a visible state, a restrained colour and its recency in the OpenSpec
panel, so the user can tell finished, moving, untouched and unplanned changes apart at a glance.

## ADDED Requirements

### Requirement: Each change has one state
The panel SHALL classify each active change as `drafting` (no tasks.md, or a tasks.md without
checkboxes), `not started` (0 done), `in progress` (some done) or `done` (all done).

#### Scenario: Classification
- **WHEN** the changes have no tasks.md, 0/4, 2/4 and 4/4 tasks
- **THEN** their states are `drafting`, `not started`, `in progress` and `done`

### Requirement: State colours follow Orca's theme
Each state SHALL have one colour that is legible in Orca's light and dark themes. `in progress`
SHALL use the theme's primary colour, `done` a green, and `not started` and `drafting` the muted
foreground. The panel SHALL follow theme switches without reloading. Apart from progress bars,
red SHALL be used only for errors.

#### Scenario: Theme switch
- **WHEN** the user switches Orca from dark to light with the panel open
- **THEN** the panel's surfaces and state colours change to the light theme with no reload

#### Scenario: Contrast
- **WHEN** a state pill or count is drawn on a card in either theme
- **THEN** its text has a contrast ratio of at least 4.5:1 against its background

### Requirement: Change cards show their state
Each card SHALL show a coloured stripe on its left edge, a pill with the state's name, and a
progress bar filled to `done/total`, followed by `done/total`. A `drafting` card SHALL show no bar.
Cards SHALL use the theme's card surface; only a `done` card gets a faint tint of its colour.

#### Scenario: Card of a change in progress
- **WHEN** the list shows a change with 5/12 tasks
- **THEN** its stripe and its `In progress` pill use the primary colour, and its bar is 42% filled
  in a yellow-orange, with `5/12` beside the bar

#### Scenario: Card of a finished change
- **WHEN** the list shows a change with 4/4 tasks
- **THEN** its stripe, pill and full bar are green, and the card has a faint green tint

#### Scenario: Card of a change being drafted
- **WHEN** the list shows a change with only proposal.md
- **THEN** it shows a muted `Drafting` pill and no progress bar

### Requirement: Progress bars run from red to green
Every progress bar (cards, detail header and task sections) SHALL be filled with one colour picked
from its share done, on a scale from red at 0% through orange and yellow to green at 100%.

#### Scenario: Colour by share done
- **WHEN** bars are 0%, 25%, 50%, 75% and 100% filled
- **THEN** their fills are red, orange, yellow, yellow-green and green

### Requirement: Changes show and sort by recency
Each card SHALL show how long ago a file in the change's folder was last modified, such as
`edited 5 min ago`, kept current while the panel is open. The list SHALL be ordered from the most
recently edited change down.

#### Scenario: Order
- **WHEN** `a` was edited 2 hours ago and `b` 5 minutes ago
- **THEN** `b` is listed before `a`, and `b` reads `edited 5 min ago`

### Requirement: Plugin header
The panel SHALL start with a header that stays in the list and detail views. Its first line holds
an icon tile, the name `OpenSpec Pulse` and the plugin version from its manifest. Below that comes
a muted subtitle for the focused workspace. On the right are icon buttons for New proposal (`+`),
Explore and Refresh, each with an accessible name and a tooltip.

#### Scenario: Workspace with changes
- **WHEN** the focused workspace `rabbitfish` has two active changes
- **THEN** the header reads `OpenSpec Pulse  v0.1.0`, then `rabbitfish · 2 changes`

#### Scenario: Subtitle per situation
- **WHEN** there is no focused workspace, the workspace is remote, it has no OpenSpec, or it has no
  active changes
- **THEN** the subtitle reads `No workspace`, `<name> · remote`, `<name> · No OpenSpec here` or
  `<name> · No active changes`

#### Scenario: Header actions
- **WHEN** the user presses `+` in the header
- **THEN** the first-prompt form for a new proposal opens, as the old New proposal button did

#### Scenario: Header actions without OpenSpec
- **WHEN** the workspace has no OpenSpec or is remote
- **THEN** `+` and Explore are disabled and Refresh still works

#### Scenario: Version unreadable
- **WHEN** the manifest cannot be read
- **THEN** the header shows the name without a version, and the panel works on

### Requirement: Summary strip counts and filters by state
Above the list, the panel SHALL show one item per state that has changes: a dot in its colour and
`N <state>`. Items are ordered in progress, not started, drafting, done, and zero counts are left
out. Pressing an item SHALL show only that state's changes and mark the item as pressed. Pressing
it again, or another item, SHALL change the filter. The strip SHALL be hidden with no changes.

#### Scenario: Mixed changes
- **WHEN** the workspace has two changes in progress and one done
- **THEN** the strip shows `● 2 in progress` and `● 1 done` in their colours

#### Scenario: Filter
- **WHEN** the user presses `2 in progress`
- **THEN** only those two cards are listed and the item is marked as pressed; pressing it again
  lists all changes

#### Scenario: Filtered state disappears
- **WHEN** a filter is on and the last change in that state moves to another state
- **THEN** the filter is cleared and all changes are listed

### Requirement: Detail view shows progress per section
The detail view SHALL show the change's card header (state pill, bar, stepper and actions), then
its artifacts and specs as rows that open the file. Each task section SHALL have its own small
progress bar and `done/total`, and its tasks with a checkbox each: done ones checked in green and
their text muted, pending ones an empty box with a visible border.

#### Scenario: Section progress
- **WHEN** a change's tasks.md has the section `2. Status bar` with 1 of 3 tasks done
- **THEN** the section header shows a bar a third filled and `1/3`

### Requirement: Panel is usable by keyboard and screen reader
Every control SHALL be reachable with Tab and work with Enter or Space. Icon-only buttons SHALL have
an accessible name. Filter items SHALL expose their pressed state. The progress bars SHALL expose
their value. State SHALL never be conveyed by colour alone.

#### Scenario: Keyboard only
- **WHEN** the user tabs through the panel
- **THEN** focus moves through the header buttons, the strip items and each card's actions
  in order, with a visible focus ring

#### Scenario: Colour-blind reading
- **WHEN** the state colours cannot be told apart
- **THEN** each card's state can still be read from its pill text
