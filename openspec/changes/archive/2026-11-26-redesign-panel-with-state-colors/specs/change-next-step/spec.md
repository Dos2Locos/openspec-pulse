# Spec Delta

## Purpose

Tells the user where each change stands in the OpenSpec lifecycle and offers the one action that
moves it forward, instead of four equal icons.

## ADDED Requirements

### Requirement: Lifecycle stepper
Each change card and the detail header SHALL show the steps `proposal › specs › design › tasks`.
Each step is marked done when its artifact exists (`specs/` for specs) and missing otherwise. While
tasks.md is missing, the first missing step SHALL be marked as next.

#### Scenario: Change with proposal and specs
- **WHEN** a change has proposal.md and specs/ only
- **THEN** proposal and specs show done, design shows next, and tasks shows missing

#### Scenario: Design skipped
- **WHEN** a change has proposal.md, specs/ and tasks.md but no design.md
- **THEN** design shows missing, no step shows next, and the change counts as planned

### Requirement: One primary action per change
Each change SHALL show one primary button for its next step, in the primary colour:

- `Continue: <step>` while tasks.md is missing;
- `Apply` when tasks are not started or in progress;
- `Archive` when all tasks are done.

Pressing it SHALL send the same command the matching agent button sends today.

The button is an icon; its accessible name and tooltip carry the label.

#### Scenario: Next step by state
- **WHEN** the changes are drafting (design missing), in progress and done
- **THEN** their primary buttons are named `Continue: design`, `Apply` and `Archive`

#### Scenario: Same command as before
- **WHEN** the user presses `Apply` on `add-x`
- **THEN** the plugin sends `/openspec-apply-change add-x` exactly as the old apply button did

### Requirement: All actions stay one press away
Each card SHALL show the four actions (continue, apply, verify, archive) as icon buttons with an
accessible name and a tooltip, in that order, under the same rules as today: apply and verify need
tasks. The next step's button SHALL be filled in the primary colour and the others outlined.
Archive SHALL keep relying on the agent's own confirmation.

#### Scenario: Buttons of a change in progress
- **WHEN** the list shows a change in progress
- **THEN** it shows Continue, Apply, Verify and Archive, with Apply filled

#### Scenario: Buttons of a drafting change
- **WHEN** the list shows a change without tasks
- **THEN** Continue is filled, and Apply and Verify are disabled
