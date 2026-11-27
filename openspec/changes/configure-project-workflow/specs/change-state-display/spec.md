# Spec Delta

## MODIFIED Requirements

### Requirement: Each change has one state

Without explicitly configured required artifacts, the panel SHALL classify each active change
as `drafting` (no tasks.md, or no checkboxes), `not started` (0 done), `in progress` (some done)
or `done` (all done). With an explicit validated requiredArtifacts list, any missing required
artifact SHALL make the local state `drafting` and SHALL be explained. When all required
artifacts exist, the same task-based rules SHALL apply. GitHub delivery state SHALL remain
separate from this local state and SHALL NOT mark tasks or archive changes automatically.

#### Scenario: Classification
- **WHEN** no requiredArtifacts list is configured and changes have no tasks.md, 0/4, 2/4 and 4/4 tasks
- **THEN** their states remain drafting, not started, in progress and done

#### Scenario: Configured artifact missing
- **WHEN** design.md is explicitly required but absent and tasks are 4/4
- **THEN** the local state is drafting and design.md is named as missing

#### Scenario: Required artifacts present
- **WHEN** all configured required artifacts exist and tasks are 2/4
- **THEN** the local state is in progress
