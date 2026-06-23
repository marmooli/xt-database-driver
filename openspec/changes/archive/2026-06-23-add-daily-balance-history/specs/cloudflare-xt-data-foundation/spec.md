## ADDED Requirements

### Requirement: Daily balance snapshots are stored per user
The system SHALL store daily balance snapshots for imported UIDs processed by the daily balance sync.

#### Scenario: Daily sync stores a snapshot
- **WHEN** the daily balance sync receives a balance for a UID
- **THEN** the system SHALL store a balance snapshot for that UID and the Germany-local snapshot date

### Requirement: Daily balance snapshot is unique per UID and date
The system SHALL keep at most one daily balance snapshot per UID per Germany-local date.

#### Scenario: Same UID is processed again on the same date
- **WHEN** the daily balance sync processes a UID more than once on the same Germany-local date
- **THEN** the system SHALL update the existing snapshot row rather than insert a duplicate row

### Requirement: Manual balance sync does not write daily history
The system SHALL reserve daily balance history for daily balance sync results.

#### Scenario: Admin runs manual balance sync
- **WHEN** an authorized admin runs the manual balance sync endpoint
- **THEN** the system SHALL update latest balances without writing daily snapshot rows

### Requirement: Missing daily balance remains missing
The system SHALL not synthesize daily balance snapshots for UIDs that were not processed.

#### Scenario: Daily sync does not process a UID
- **WHEN** a UID is not reached by the daily balance sync on a Germany-local date
- **THEN** the system SHALL leave that UID/date without a snapshot row

