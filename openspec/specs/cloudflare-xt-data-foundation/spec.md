## Purpose

Provide the Cloudflare D1-backed foundation for importing, storing, and operationally tracking XT-derived user UID data.

## Requirements

### Requirement: D1 user catalog stores imported XT UIDs
The system SHALL store imported XT affiliate users in a Cloudflare D1 user catalog keyed by XT UID.

#### Scenario: Import stores a new UID
- **WHEN** the UID import receives an affiliate user item with a UID that is not yet stored
- **THEN** the system SHALL create one user catalog row containing the UID and available source metadata from the affiliate user item

#### Scenario: Import sees an existing UID again
- **WHEN** the UID import receives an affiliate user item with a UID that is already stored
- **THEN** the system SHALL update the existing user catalog row instead of creating a duplicate row

#### Scenario: UID is normalized before storage
- **WHEN** the UID import receives a numeric or string UID from XT
- **THEN** the system SHALL normalize the UID to a string before writing it to D1

### Requirement: UID import is idempotent
The system SHALL allow the same UID import to be run multiple times without creating duplicate user records.

#### Scenario: Same source page is processed twice
- **WHEN** the same XT affiliate user page is processed more than once
- **THEN** the system SHALL keep one user catalog row per UID and update the row's last-seen import metadata

### Requirement: Import runs are tracked durably
The system SHALL record each UID import run in D1 with operational status and count metadata.

#### Scenario: Import completes successfully
- **WHEN** a UID import run finishes without an unrecovered source or database error
- **THEN** the system SHALL record the run as successful with start time, end time, processed count, inserted count, updated count, and skipped count

#### Scenario: Import fails
- **WHEN** a UID import run stops because of an unrecovered source or database error
- **THEN** the system SHALL record the run as failed with start time, failure time, processed count available so far, and an error message

#### Scenario: Import records cursor range
- **WHEN** a UID import run processes one or more source pages
- **THEN** the system SHALL record the starting cursor and final cursor available for the run

### Requirement: Initial phase limits imported fields
The system SHALL limit the first import phase to UID discovery data and SHALL NOT import sensitive profile, KYC, balance, commission, rebate, or trade details.

#### Scenario: UID import reads affiliate users
- **WHEN** the UID import processes data from `get_all_affiliate_users`
- **THEN** the system SHALL store only UID-oriented affiliate listing fields and source bookkeeping fields needed for later enrichment

### Requirement: Import source is configurable
The system SHALL read XT UID data through a configurable HTTP source rather than hard-coding environment-specific credentials in application code.

#### Scenario: Runtime source configuration is provided
- **WHEN** the importer starts in a Cloudflare environment
- **THEN** the system SHALL use configured bindings, variables, or secrets to determine the XT source and authentication details

### Requirement: UID import handles source pagination
The system SHALL read affiliate user pages incrementally using the XT source pagination contract.

#### Scenario: Source has another page
- **WHEN** the XT affiliate user response indicates another page is available
- **THEN** the system SHALL request the next page using the returned cursor or the last processed source id

#### Scenario: Source is exhausted
- **WHEN** the XT affiliate user response indicates no next page or returns no items
- **THEN** the system SHALL stop the import and mark the run according to the processed result

#### Scenario: Page size is selected
- **WHEN** the importer requests affiliate user pages
- **THEN** the system SHALL use a page size no larger than the XT source maximum of 100

### Requirement: Manual import entrypoint is protected
The system SHALL protect any production manual import entrypoint from unauthenticated public access.

#### Scenario: Import request lacks authorization
- **WHEN** a production manual import request does not include the configured authorization secret or equivalent admin control
- **THEN** the system SHALL reject the request without starting an import run

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

### Requirement: Imported UID rows are listable by admins
The system SHALL expose a protected API for listing imported UID catalog rows.

#### Scenario: Admin lists imported UIDs
- **WHEN** an authorized admin requests imported UID rows
- **THEN** the system SHALL return a bounded page of UID rows sorted by recent activity

#### Scenario: Unauthorized user list request is rejected
- **WHEN** a user list request lacks valid admin authorization
- **THEN** the system SHALL reject the request without returning UID data

### Requirement: User balances are stored as current enrichment
The system SHALL store the latest known balance for imported UIDs.

#### Scenario: Balance sync stores a value
- **WHEN** an authorized balance sync receives a balance for a UID
- **THEN** the system SHALL store the balance and balance sync timestamp for that UID

### Requirement: Balance sync is bounded
The system SHALL sync user balances in bounded chunks.

#### Scenario: Admin starts balance sync
- **WHEN** an authorized admin starts balance sync with a limit
- **THEN** the system SHALL process no more than the requested bounded limit

### Requirement: Users are sortable by balance
The system SHALL allow protected user listing to sort by current balance.

#### Scenario: Admin sorts by highest balance
- **WHEN** an authorized admin requests users sorted by balance descending
- **THEN** the system SHALL return users ordered from highest known balance to lowest known balance
