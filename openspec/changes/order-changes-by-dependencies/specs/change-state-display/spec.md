# Spec Delta

## MODIFIED Requirements

### Requirement: Changes show and sort by recency

Each card SHALL show how long ago a file in the change's folder was last modified, such as
`edited 5 min ago`, kept current while the panel is open. The default list order SHALL be most
recently edited first. The user MAY select dependency order instead and mark local favorites;
favorites SHALL form a separate leading group without hiding dependency or cycle warnings.

#### Scenario: Order
- **WHEN** no ordering preference exists and `a` was edited 2 hours ago and `b` 5 minutes ago
- **THEN** `b` is listed before `a` and reads `edited 5 min ago`

#### Scenario: Dependency order
- **WHEN** dependency order is selected and `b` depends on `a`
- **THEN** the unpinned list places `a` before `b` regardless of recency and both keep their ages

#### Scenario: Favorite with a dependency
- **WHEN** a dependent change is marked as a local favorite
- **THEN** it appears in the favorites group with its dependency warning still visible
