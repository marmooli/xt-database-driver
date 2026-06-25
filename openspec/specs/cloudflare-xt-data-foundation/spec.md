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

### Requirement: User referral codes are stored as catalog enrichment
The system SHALL store each imported user's XT registration invite code when it is available from user-info enrichment.

#### Scenario: User info sync stores a referral code
- **WHEN** an authorized user-info sync receives a `registerInviteCode` for an imported UID
- **THEN** the system SHALL store that referral code and the user-info sync timestamp on the user catalog row

#### Scenario: User info sync marks a user as checked
- **WHEN** an authorized user-info sync receives user info for an imported UID without a referral code
- **THEN** the system SHALL store the user-info sync timestamp so the same UID is not repeatedly queried as pending

#### Scenario: User info sync is bounded
- **WHEN** an authorized admin starts user-info sync with a limit
- **THEN** the system SHALL process no more than the requested bounded limit

#### Scenario: User list includes referral code
- **WHEN** an authorized admin lists imported UID rows
- **THEN** the system SHALL include each row's stored registration invite code when available

### Requirement: Referral-code backfill processes pending users through a queue
The system SHALL backfill referral-code user info through bounded queue chunks for imported users that have not yet been checked.

#### Scenario: Admin starts referral-code backfill
- **WHEN** an authorized admin starts referral-code backfill
- **THEN** the system SHALL mark referral-code backfill as running and enqueue a first chunk

#### Scenario: More unchecked users remain
- **WHEN** a referral-code backfill chunk processes the configured chunk limit
- **THEN** the system SHALL enqueue another referral-code backfill chunk

#### Scenario: No unchecked users remain
- **WHEN** a referral-code backfill chunk reaches fewer users than the configured chunk limit
- **THEN** the system SHALL mark referral-code backfill as successful

#### Scenario: Backfill is already running
- **WHEN** an authorized admin starts referral-code backfill while the backfill state is running
- **THEN** the system SHALL not enqueue a duplicate first chunk

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

### Requirement: Trade ingestion uses the signed HTTP proxy route
The system SHALL fetch user deposit and trading data for trade sync from the direct signed HTTP proxy route rather than from the MCP transport.

#### Scenario: Daily trade sync fetches through the proxy route
- **WHEN** the daily trade sync requests user deposit/trading data for a UID and Germany-local day
- **THEN** the system SHALL call the signed HTTP proxy route and parse the returned trade data

#### Scenario: Historical trade backfill fetches through the proxy route
- **WHEN** the historical trade backfill requests user deposit/trading data for a UID and Germany-local date
- **THEN** the system SHALL call the signed HTTP proxy route and parse the returned trade data

#### Scenario: Trade source keeps the same stored semantics
- **WHEN** trade data is fetched through the signed HTTP proxy route
- **THEN** the system SHALL continue storing the same trade amount, trade flag, source time range, and daily snapshot semantics as before

### Requirement: Historical trade backfill prioritizes higher cumulative trade volume
The system SHALL choose the next historical trade backfill user by descending cumulative trade volume stored in the database.

#### Scenario: Backfill starts from the highest-volume user
- **WHEN** an authorized admin starts historical trade-volume backfill
- **THEN** the system SHALL enqueue the user with the highest cumulative stored trade volume first

#### Scenario: Backfill continues by descending cumulative volume
- **WHEN** a historical trade backfill chunk completes a user and there are more users to process
- **THEN** the system SHALL continue with the next user whose cumulative stored trade volume is lower than the last processed user

### Requirement: Historical trade backfill remains deterministic for tied volumes
The system SHALL break ties in historical trade backfill order by ascending UID so the ordering remains deterministic.

#### Scenario: Two users have the same cumulative trade volume
- **WHEN** the system selects between users with equal cumulative stored trade volume
- **THEN** the system SHALL choose the user with the lower UID first

#### Scenario: A user has no stored trade volume
- **WHEN** the system encounters users with no stored trade snapshots yet
- **THEN** the system SHALL treat them as zero-volume users and place them after users with positive cumulative trade volume

