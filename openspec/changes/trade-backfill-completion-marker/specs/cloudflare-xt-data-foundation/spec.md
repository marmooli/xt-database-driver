## ADDED Requirements

### Requirement: Historical trade backfill stores per-user completion markers
The system SHALL store the Germany-local date through which each user's historical trade backfill is complete.

#### Scenario: User reaches the current backfill window end
- **WHEN** a historical trade backfill chunk finishes processing a user through the current target Germany-local date without any missing snapshots remaining
- **THEN** the system SHALL store that target date as the user's trade backfill completion marker

#### Scenario: User is not yet complete
- **WHEN** a historical trade backfill chunk still has more missing dates for a user before the current target date
- **THEN** the system SHALL leave the user's completion marker unchanged

### Requirement: Historical trade backfill skips users already complete through the current target date
The system SHALL not reselect a user for historical trade backfill when that user's completion marker already covers the current target Germany-local date.

#### Scenario: Backfill considers an already-complete user
- **WHEN** the historical trade backfill selects the next candidate user for the current target date and the user is already complete through that date
- **THEN** the system SHALL skip that user and continue with the next eligible user

#### Scenario: Target date advances beyond the stored completion marker
- **WHEN** the current target Germany-local date is later than the stored completion marker for a user
- **THEN** the system SHALL consider that user eligible again for the newer target date
