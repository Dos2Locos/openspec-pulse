# Spec Delta

## Purpose

Lists the main specs of the focused workspace, the behaviour the system promises today, so the user
can see which capabilities exist and open any of them.

## ADDED Requirements

### Requirement: Spec list
The `Specs` tab SHALL list every capability folder under `openspec/specs/` that holds a `spec.md`,
sorted by name. Each row SHALL show the capability, the first line of its `## Purpose`, and its
number of requirements.

#### Scenario: Capability row
- **WHEN** `openspec/specs/status-bar-summary/spec.md` has a Purpose and 6 requirements
- **THEN** its row reads `status-bar-summary`, the Purpose's first line and `6 requirements`

#### Scenario: Spec without a Purpose
- **WHEN** a spec.md has no `## Purpose` section
- **THEN** its row shows the capability and its requirement count with no description

#### Scenario: No specs
- **WHEN** `openspec/specs/` is missing or holds no `spec.md`
- **THEN** the tab shows `No specs yet` and says that archiving a change creates them

### Requirement: Open a spec
Pressing a spec row SHALL open its `spec.md` in Orca's editor.

#### Scenario: Open
- **WHEN** the user presses `status-bar-summary`
- **THEN** `openspec/specs/status-bar-summary/spec.md` opens in Orca's editor

### Requirement: Spec paths stay inside openspec/specs
The plugin SHALL only open a spec whose capability folder is listed under `openspec/specs/`.

#### Scenario: Name outside the specs
- **WHEN** the panel asks to open the spec `../changes/add-x`
- **THEN** nothing is opened
