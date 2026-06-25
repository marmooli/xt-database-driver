## ADDED Requirements

### Requirement: Daily fee snapshots are stored per user
The system SHALL store a daily fee total for each imported UID and Germany-local fee date.

#### Scenario: Daily fee sync stores a snapshot
- **WHEN** the daily fee sync receives commission fee rows for a UID and Germany-local day
- **THEN** the system SHALL store one fee snapshot containing the sum of the commission `fee` values for that UID and day

#### Scenario: Multiple commission rows exist for the same day
- **WHEN** multiple commission rows exist for the same UID and Germany-local day
- **THEN** the system SHALL aggregate them into a single stored daily fee total

### Requirement: Daily fee sync targets the previous complete Germany day
The system SHALL sync daily fee totals for the previous complete `Europe/Berlin` day.

#### Scenario: Scheduled fee sync starts
- **WHEN** Cloudflare invokes the scheduled Worker event
- **THEN** the system SHALL enqueue fee sync work for yesterday's Germany-local date

### Requirement: Daily fee snapshots are unique per UID and date
The system SHALL keep at most one daily fee snapshot per UID per Germany-local date.

#### Scenario: Same UID is processed again for a date
- **WHEN** the daily fee sync processes a UID more than once for the same fee date
- **THEN** the system SHALL update the existing snapshot row rather than insert a duplicate row

### Requirement: Daily fee sync uses bounded queue chunks
The system SHALL process daily fee sync work through bounded queue chunks.

#### Scenario: More users remain after a chunk
- **WHEN** a daily fee sync chunk processes the configured chunk limit
- **THEN** the system SHALL store the next cursor and enqueue another fee chunk

### Requirement: Historical fee backfill uses bounded queue chunks
The system SHALL backfill missing per-user daily fee snapshots through bounded queue chunks.

#### Scenario: Admin starts historical fee backfill
- **WHEN** an authorized admin starts historical fee backfill
- **THEN** the system SHALL mark the backfill as running and enqueue the first chunk

#### Scenario: Backfill processes missing dates
- **WHEN** a backfill chunk reaches a UID and Germany-local fee date without an existing snapshot
- **THEN** the system SHALL fetch that user's commission fee data for that date and store it as a daily fee snapshot

#### Scenario: Backfill sees an existing snapshot
- **WHEN** a backfill chunk reaches a UID and Germany-local fee date with an existing snapshot
- **THEN** the system SHALL skip that date without calling the XT source

#### Scenario: Backfill continues across dates and users
- **WHEN** a backfill chunk reaches its configured day limit before all historical dates are checked
- **THEN** the system SHALL enqueue a follow-up chunk for the next date or next UID

### Requirement: Daily fee sync state is inspectable and resettable by admins
The system SHALL expose protected admin controls for reading and resetting daily fee sync state.

#### Scenario: Admin reads fee sync state
- **WHEN** an authorized admin requests daily fee sync status
- **THEN** the system SHALL return the durable cursor state and latest fee sync status

#### Scenario: Admin starts fee sync
- **WHEN** an authorized admin starts daily fee sync
- **THEN** the system SHALL mark the daily fee sync as running and enqueue the first chunk

#### Scenario: Admin resets fee sync state
- **WHEN** an authorized admin resets daily fee sync state
- **THEN** the system SHALL clear the next cursor so the next scheduled chunk starts from the newest source day
