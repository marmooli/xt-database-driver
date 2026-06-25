## MODIFIED Requirements

### Requirement: Historical trade volume backfill uses bounded queue chunks
The system SHALL backfill missing per-user daily trade-volume snapshots through bounded queue chunks and SHALL respect the heavy-backfill serialization guardrails.

#### Scenario: Admin starts historical trade backfill
- **WHEN** an authorized admin starts historical trade-volume backfill while fee history backfill is not running
- **THEN** the system SHALL mark the backfill as running and enqueue the first chunk

#### Scenario: Admin starts trade backfill while fee backfill is running
- **WHEN** an authorized admin starts historical trade-volume backfill while fee history backfill is running
- **THEN** the system SHALL not enqueue a duplicate first chunk and SHALL report that a heavy backfill is already running

#### Scenario: Backfill processes missing dates
- **WHEN** a backfill chunk reaches a UID and Germany-local trade date without an existing snapshot
- **THEN** the system SHALL fetch that user's trade volume for that date and store it as a daily trade snapshot

#### Scenario: Backfill sees an existing snapshot
- **WHEN** a backfill chunk reaches a UID and Germany-local trade date with an existing snapshot
- **THEN** the system SHALL skip that date without calling the XT source

#### Scenario: Backfill continues across dates and users
- **WHEN** a backfill chunk reaches its configured day limit before all historical dates are checked
- **THEN** the system SHALL enqueue a follow-up chunk for the next date or next UID

### Requirement: Historical fee backfill uses bounded queue chunks
The system SHALL backfill missing per-user daily fee snapshots through bounded queue chunks and SHALL respect the heavy-backfill serialization guardrails.

#### Scenario: Admin starts historical fee backfill
- **WHEN** an authorized admin starts historical fee backfill while trade history backfill is not running
- **THEN** the system SHALL mark the backfill as running and enqueue the first chunk

#### Scenario: Admin starts fee backfill while trade backfill is running
- **WHEN** an authorized admin starts historical fee backfill while trade history backfill is running
- **THEN** the system SHALL not enqueue a duplicate first chunk and SHALL report that a heavy backfill is already running

#### Scenario: Backfill processes missing dates
- **WHEN** a backfill chunk reaches a UID and Germany-local fee date without an existing snapshot
- **THEN** the system SHALL fetch that user's commission fee data for that date and store it as a daily fee snapshot

#### Scenario: Backfill sees an existing snapshot
- **WHEN** a backfill chunk reaches a UID and Germany-local fee date with an existing snapshot
- **THEN** the system SHALL skip that date without calling the XT source

#### Scenario: Backfill continues across dates and users
- **WHEN** a backfill chunk reaches its configured day limit before all historical dates are checked
- **THEN** the system SHALL enqueue a follow-up chunk for the next date or next UID
