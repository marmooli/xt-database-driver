## ADDED Requirements

### Requirement: Daily trade volume snapshots are stored per user
The system SHALL store daily trade-volume snapshots for imported UIDs.

#### Scenario: Daily trade sync stores a snapshot
- **WHEN** the daily trade sync receives trade data for a UID
- **THEN** the system SHALL store trade amount, trade flag, and source time range for that UID and Germany-local trade date

### Requirement: Daily trade sync targets the previous complete Germany day
The system SHALL sync daily trade volume for the previous complete `Europe/Berlin` day.

#### Scenario: Scheduled trade sync starts
- **WHEN** Cloudflare invokes the scheduled Worker event
- **THEN** the system SHALL enqueue trade sync work for yesterday's Germany-local date

### Requirement: Daily trade snapshots are unique per UID and date
The system SHALL keep at most one daily trade-volume snapshot per UID per Germany-local date.

#### Scenario: Same UID is processed again for a date
- **WHEN** the daily trade sync processes a UID more than once for the same trade date
- **THEN** the system SHALL update the existing snapshot row rather than insert a duplicate row

### Requirement: Daily trade sync uses bounded queue chunks
The system SHALL process daily trade sync work through bounded queue chunks.

#### Scenario: More users remain after a chunk
- **WHEN** a daily trade sync chunk processes the configured chunk limit
- **THEN** the system SHALL store the next cursor and enqueue another chunk

