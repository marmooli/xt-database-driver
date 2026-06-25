## ADDED Requirements

### Requirement: Historical fee backfill prioritizes higher cumulative fee
The system SHALL choose the next historical fee backfill user by descending cumulative fee stored in the database.

#### Scenario: Backfill starts from the highest-fee user
- **WHEN** an authorized admin starts historical fee backfill
- **THEN** the system SHALL enqueue the user with the highest cumulative stored fee first

#### Scenario: Backfill continues by descending cumulative fee
- **WHEN** a historical fee backfill chunk completes a user and there are more users to process
- **THEN** the system SHALL continue with the next user whose cumulative stored fee is lower than the last processed user

### Requirement: Historical fee backfill remains deterministic for tied or missing cumulative fee values
The system SHALL break ties in historical fee backfill order by ascending UID and SHALL treat users with no stored fee history as zero-fee users.

#### Scenario: Two users have the same cumulative fee
- **WHEN** the system selects between users with equal cumulative stored fee
- **THEN** the system SHALL choose the user with the lower UID first

#### Scenario: A user has no stored fee history
- **WHEN** the system encounters users with no stored fee snapshots yet
- **THEN** the system SHALL treat them as zero-fee users and place them after users with positive cumulative fee
