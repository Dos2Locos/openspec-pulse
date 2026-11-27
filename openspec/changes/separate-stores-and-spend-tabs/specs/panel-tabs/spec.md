# Spec Delta

Tab names below identify views using the English catalog. Visible labels SHALL use the effective UI language defined by ui-localization.

## MODIFIED Requirements

### Requirement: Tabs for active, archive and specs
When the focused workspace has readable OpenSpec, the panel SHALL show `Active`, `Archive`, `Specs`, `Stores` and `Spend` under its header. Only the first three SHALL have item counts. `Active` SHALL be selected first. Without readable OpenSpec, tabs SHALL be hidden except for `Active` and `Stores` in a local workspace where store management is available; Active SHALL retain the existing initialization or diagnostic view. Remote or absent workspaces SHALL have no tabs.

#### Scenario: Counts
- **WHEN** a workspace has 2 active changes, 5 archived changes and 3 specs
- **THEN** the tabs read `Active 2`, `Archive 5`, `Specs 3`, `Stores` and `Spend`, with `Active` selected

#### Scenario: No OpenSpec
- **WHEN** a local workspace has no readable OpenSpec and store management is available
- **THEN** Active retains its initialization or diagnostic view and Stores remains reachable for linking or repairing a store

#### Scenario: Remote workspace
- **WHEN** the workspace is remote or no workspace is selected
- **THEN** no tabs are shown

### Requirement: Switching tabs
Pressing a tab SHALL replace the current content and mark it selected. The summary strip and its filter SHALL belong to Active only. Switching tabs SHALL preserve per-list searches, filters and pagination and unsent store drafts and pending previews within the same workspace. Switching workspace SHALL return to Active and clear workspace-specific store drafts and previews.

#### Scenario: Open the archive
- **WHEN** the user presses Archive
- **THEN** the archive list is shown, Archive is selected and the summary strip is hidden

#### Scenario: Workspace switch
- **WHEN** Specs, Stores or Spend is selected and the user switches workspace
- **THEN** the new workspace opens in Active without drafts or pending store confirmations from the previous workspace

#### Scenario: Return to filtered changes
- **WHEN** the user leaves a filtered and paginated Active list for Spend and returns
- **THEN** the query, state filter, ordering and loaded page limit remain intact

#### Scenario: Pending store preview
- **WHEN** the user opens a store operation preview, visits Active and returns to Stores in the same workspace
- **THEN** the preview remains available and no operation has been committed by changing tabs

### Requirement: Tabs are usable by keyboard and screen reader
The tabs SHALL be reachable with Tab, work with Enter or Space, expose which one is selected, and remain visible and usable at a panel width of 320 CSS pixels without causing horizontal page overflow.

#### Scenario: Keyboard
- **WHEN** the user tabs to Specs and presses Space
- **THEN** the specs list is shown and Specs is announced as selected

#### Scenario: Narrow panel
- **WHEN** the panel is 320 CSS pixels wide
- **THEN** every tab remains reachable with a visible label and the tab bar does not widen the page

## ADDED Requirements

### Requirement: Dedicated Stores content
Store management SHALL appear only in Stores, with its main content immediately visible. It SHALL preserve effective-root information, scope, compatibility diagnostics and explicit operation confirmation. Loading, unavailable and error states SHALL be explained in that tab. Store diagnostics required to explain unreadable changes SHALL remain visible in the relevant diagnostic view.

#### Scenario: Open Stores
- **WHEN** the user selects Stores
- **THEN** store management replaces the list without requiring an additional disclosure click

#### Scenario: Incompatible CLI
- **WHEN** store operations are unavailable due to CLI compatibility
- **THEN** Stores displays the reason and disables those operations while local browsing remains available

### Requirement: Dedicated spend content
Spend SHALL appear only in Spend, with totals and grouping immediately visible. The tab SHALL retain the selected worktree scope, aggregation controls, coverage information and cost qualifications provided by the spend capability. It SHALL distinguish loading, unavailable or disabled consumption, no valid records and refresh failures; unavailable cost SHALL never be rendered as a known zero.

#### Scenario: Open Spend
- **WHEN** the user selects Spend with available spend data
- **THEN** totals and grouping appear without an additional disclosure click and no change list or store forms appear

#### Scenario: No spend available
- **WHEN** the selected scope has no available consumption source
- **THEN** Spend explains that state rather than showing a blank page or a known zero cost

#### Scenario: Refresh failure
- **WHEN** a refresh fails while previous spend data exists
- **THEN** the previous data remains identified as stale alongside the failure

### Requirement: Content isolation across surfaces
Lists and change or spec details SHALL omit global store controls and global spend summaries. Panel and board SHALL use the same tab content separation while retaining their existing detail navigation and worktree context.

#### Scenario: Focused changes view
- **WHEN** Active is selected or a change detail is open
- **THEN** no global store management or global spend block is inserted before the changes or detail

#### Scenario: Board
- **WHEN** Stores or Spend is opened in the board
- **THEN** only that tab's content is shown and returning to Active restores the existing board
