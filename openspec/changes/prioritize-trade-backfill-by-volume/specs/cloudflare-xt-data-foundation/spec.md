## ADDED Requirements

### Requirement: Historical trade backfill prioritizes higher cumulative trade volume
The system SHALL choose the next historical trade backfill user by descending cumulative trade volume stored in the database.

#### Scenario: Backfill starts from the highest-volume user
- **WHEN** an authorized admin starts historical trade-volume backfill
- **THEN** the system SHALL enqueue the user with the highest cumulative stored trade volume first

#### Scenario: Backfill continues by descending cumulative volume
- **WHEN** a historical trade backfill chunk completes a user and there are more users to process
- **THEN** the system SHALL continue with the next user whose cumulative stored trade volume is lower than the last processed user

### Requirement: Historical trade backfill remains deterministic for tied volumes
The system SHALL break ties in historical trade backfill order by ascending UID so the ordering remains deterministic.

#### Scenario: Two users have the same cumulative trade volume
- **WHEN** the system selects between users with equal cumulative stored trade volume
- **THEN** the system SHALL choose the user with the lower UID first

#### Scenario: A user has no stored trade volume
- **WHEN** the system encounters users with no stored trade snapshots yet
- **THEN** the system SHALL treat them as zero-volume users and place them after users with positive cumulative trade volume
