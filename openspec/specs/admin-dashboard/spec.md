## Purpose

Provide a protected browser-based operational dashboard for inspecting and managing the XT data foundation.

## Requirements

### Requirement: Dashboard is served by the Worker
The system SHALL serve an admin dashboard page from the deployed Worker.

#### Scenario: Admin opens dashboard
- **WHEN** a browser requests `/`
- **THEN** the system SHALL return an HTML dashboard document

### Requirement: Dashboard uses admin token for protected data
The dashboard SHALL use the existing admin bearer token model when requesting protected operational data.

#### Scenario: Token is missing
- **WHEN** the dashboard requests protected data without an admin token
- **THEN** the protected API SHALL reject the request

#### Scenario: Token is provided
- **WHEN** the dashboard requests protected data with the configured admin token
- **THEN** the protected API SHALL return dashboard data

### Requirement: Dashboard displays UID sync overview
The dashboard SHALL display current UID sync overview data.

#### Scenario: Status loads successfully
- **WHEN** an authorized admin refreshes the dashboard
- **THEN** the dashboard SHALL show user count, latest run status, and scheduled sync state

### Requirement: Dashboard exposes safe operational actions
The dashboard SHALL expose bounded operational actions for UID sync management.

#### Scenario: Admin starts bounded import
- **WHEN** an authorized admin starts a dashboard import action
- **THEN** the system SHALL run a bounded UID import request

#### Scenario: Admin resets scheduled sync
- **WHEN** an authorized admin resets scheduled sync state
- **THEN** the system SHALL clear the scheduled cursor state

#### Scenario: Admin starts trade-history backfill
- **WHEN** an authorized admin starts the dashboard trade-history backfill action
- **THEN** the system SHALL start queue-backed historical trade-volume backfill

### Requirement: Dashboard displays balance
The dashboard SHALL display latest known user balance when available.

#### Scenario: Balance data is available
- **WHEN** dashboard user rows include balance data
- **THEN** the dashboard SHALL show the balance in the user table

### Requirement: Dashboard can sort by balance
The dashboard SHALL allow admins to sort user rows by balance.

#### Scenario: Admin selects balance sort
- **WHEN** an admin selects balance descending or ascending
- **THEN** the dashboard SHALL reload user rows with the selected balance sort

### Requirement: Dashboard displays registration date
The dashboard SHALL display each user's XT registration date in Germany-local calendar format when available.

#### Scenario: Registration date is available
- **WHEN** dashboard user rows include `registered_at`
- **THEN** the dashboard SHALL show the registration date as `YYYY-MM-DD`

#### Scenario: Admin toggles registration display mode
- **WHEN** an admin toggles the registration column header
- **THEN** the dashboard SHALL switch between registration date and days since registration

### Requirement: Dashboard can sort by registration date
The dashboard SHALL allow admins to sort user rows by registration date.

#### Scenario: Admin selects registration sort
- **WHEN** an admin selects registration newest-first or oldest-first sort
- **THEN** the dashboard SHALL reload user rows with the selected registration sort

### Requirement: Dashboard displays referral codes
The dashboard SHALL display stored XT registration invite codes for UID rows when available.

#### Scenario: Referral code data is available
- **WHEN** dashboard user rows include `register_invite_code`
- **THEN** the dashboard SHALL show the referral code in the user table

### Requirement: Dashboard can filter by referral code
The dashboard SHALL allow admins to filter main user rows by selected referral codes.

#### Scenario: Admin filters referral codes
- **WHEN** an admin selects a subset of referral codes from the referral-code column filter
- **THEN** the dashboard SHALL reload user rows limited to users with the selected referral codes

#### Scenario: Admin clears referral-code filter
- **WHEN** an admin clears the referral-code filter
- **THEN** the dashboard SHALL reload user rows without a referral-code filter

### Requirement: Dashboard can start bounded referral-code sync
The dashboard SHALL expose an admin action for starting queue-backed registration invite code backfill.

#### Scenario: Admin starts referral-code sync
- **WHEN** an authorized admin starts the dashboard referral-code sync action
- **THEN** the system SHALL start referral-code backfill for users without stored user info

### Requirement: Dashboard exposes a referral codes page
The system SHALL serve a separate page for listing distinct referral codes and their usage counts.

#### Scenario: Admin opens referral codes page
- **WHEN** a browser requests `/referrals`
- **THEN** the system SHALL return an HTML referral code dashboard document

#### Scenario: Referral code data loads successfully
- **WHEN** an authorized admin loads the referral codes page
- **THEN** the page SHALL fetch and display distinct referral codes and user counts

### Requirement: Dashboard links users to trade history
The dashboard SHALL link each user's 30-day trade volume to a dedicated user trade history page.

#### Scenario: Admin opens user trade history
- **WHEN** an admin clicks a user's 30-day trade volume
- **THEN** the system SHALL open a page dedicated to that UID's trade volume history

### Requirement: User trade history chart supports time grains
The user trade history page SHALL show trade volume as a bar chart aggregated by selectable time grain.

#### Scenario: Daily grain is selected
- **WHEN** the user trade history page loads with daily grain
- **THEN** the chart SHALL show one bar per Germany-local day from registration date through yesterday

#### Scenario: Larger grain is selected
- **WHEN** an admin selects weekly, monthly, or yearly grain
- **THEN** the chart SHALL show bars using the sum of daily trade volume within each period

#### Scenario: Day has no stored data
- **WHEN** a day has no daily trade snapshot row
- **THEN** the chart SHALL distinguish that missing day from a stored zero-volume day
