## ADDED Requirements

### Requirement: Heavy backfills are serialized
The system SHALL allow only one heavy backfill operation to run at a time across trade and fee history backfills.

#### Scenario: Trade backfill is already running
- **WHEN** an authorized admin starts fee history backfill while trade history backfill is running
- **THEN** the system SHALL not start the fee backfill and SHALL report that a heavy backfill is already running

#### Scenario: Fee backfill is already running
- **WHEN** an authorized admin starts trade history backfill while fee history backfill is running
- **THEN** the system SHALL not start the trade backfill and SHALL report that a heavy backfill is already running

### Requirement: Heavy backfill chunk limits are operator-tunable and bounded
The system SHALL use configured chunk limits for heavy backfills and SHALL clamp them to safe bounds.

#### Scenario: Configured limit is within bounds
- **WHEN** a heavy backfill chunk starts with a configured limit
- **THEN** the system SHALL process no more than that limit of work units per chunk

#### Scenario: Configured limit exceeds the safe bound
- **WHEN** the configured heavy backfill limit is above the safe maximum
- **THEN** the system SHALL clamp the effective limit to the safe maximum

### Requirement: Daily syncs continue independently during heavy backfills
The system SHALL allow daily sync runs to continue while a heavy backfill is running.

#### Scenario: Daily fee sync starts during a trade backfill
- **WHEN** the scheduled daily fee sync starts while trade history backfill is running
- **THEN** the system SHALL still start the daily fee sync

#### Scenario: Daily trade sync starts during a fee backfill
- **WHEN** the scheduled daily trade sync starts while fee history backfill is running
- **THEN** the system SHALL still start the daily trade sync
