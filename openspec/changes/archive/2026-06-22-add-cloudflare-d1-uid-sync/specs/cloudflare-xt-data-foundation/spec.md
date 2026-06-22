## ADDED Requirements

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
