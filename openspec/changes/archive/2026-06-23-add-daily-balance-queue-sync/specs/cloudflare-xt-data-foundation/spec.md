## ADDED Requirements

### Requirement: Daily balance sync refreshes all imported users
The system SHALL start a daily balance sync that refreshes balances for all imported UIDs.

#### Scenario: Daily cron starts balance sync
- **WHEN** Cloudflare invokes the daily scheduled Worker event
- **THEN** the system SHALL start a balance sync run for the current day

#### Scenario: Daily balance sync completes
- **WHEN** all imported UIDs have been processed by the daily balance sync
- **THEN** the system SHALL mark the daily balance sync state as successful

### Requirement: Daily balance sync uses bounded queue chunks
The system SHALL process daily balance sync work through bounded queue chunks.

#### Scenario: More users remain after a chunk
- **WHEN** a daily balance sync chunk processes the configured chunk limit
- **THEN** the system SHALL store the next cursor and enqueue another chunk

#### Scenario: No users remain after a chunk
- **WHEN** a daily balance sync chunk reaches the end of imported UIDs
- **THEN** the system SHALL clear the cursor and stop enqueueing balance chunks

### Requirement: Daily balance sync is idempotent for a day
The system SHALL avoid starting duplicate daily balance syncs for the same day.

#### Scenario: Daily sync already started today
- **WHEN** the scheduled event runs and the daily balance sync has already started for the current day
- **THEN** the system SHALL not enqueue a duplicate first chunk

