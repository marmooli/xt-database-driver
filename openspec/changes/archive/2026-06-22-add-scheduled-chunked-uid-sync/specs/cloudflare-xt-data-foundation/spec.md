## ADDED Requirements

### Requirement: Scheduled UID sync runs in bounded chunks
The system SHALL run scheduled UID sync in bounded chunks rather than attempting an unbounded full import in one Worker execution.

#### Scenario: Scheduled event runs a chunk
- **WHEN** Cloudflare invokes the scheduled UID sync
- **THEN** the system SHALL import no more than the configured maximum number of pages for that invocation

#### Scenario: Scheduled chunk completes successfully
- **WHEN** a scheduled chunk imports UID data without an unrecovered error
- **THEN** the system SHALL record a successful sync run and update durable scheduled sync state

### Requirement: Scheduled UID sync stores durable cursor state
The system SHALL store scheduled UID sync cursor state in D1 so progress can continue across Worker invocations.

#### Scenario: Scheduled chunk has more source pages
- **WHEN** a scheduled chunk processes the configured maximum number of pages and receives a final cursor
- **THEN** the system SHALL store that cursor as the next scheduled sync cursor

#### Scenario: Scheduled chunk reaches source exhaustion
- **WHEN** a scheduled chunk processes fewer records than the configured chunk capacity
- **THEN** the system SHALL clear the next scheduled sync cursor so the next cycle starts from the newest source page

#### Scenario: Scheduled chunk fails
- **WHEN** a scheduled chunk fails before completion
- **THEN** the system SHALL preserve the previous scheduled sync cursor and record the failure state

### Requirement: Scheduled sync state is inspectable and resettable by admins
The system SHALL expose protected admin controls for reading and resetting scheduled UID sync state.

#### Scenario: Admin reads scheduled sync state
- **WHEN** an authorized admin requests scheduled sync status
- **THEN** the system SHALL return the durable cursor state and latest import status

#### Scenario: Admin resets scheduled sync state
- **WHEN** an authorized admin resets scheduled sync state
- **THEN** the system SHALL clear the next cursor so the next scheduled chunk starts from the newest source page

#### Scenario: Unauthorized state request is rejected
- **WHEN** a scheduled sync state request lacks valid admin authorization
- **THEN** the system SHALL reject the request without returning sync state
