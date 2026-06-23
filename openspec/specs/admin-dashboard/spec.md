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

### Requirement: Dashboard displays referral codes
The dashboard SHALL display stored XT registration invite codes for UID rows when available.

#### Scenario: Referral code data is available
- **WHEN** dashboard user rows include `register_invite_code`
- **THEN** the dashboard SHALL show the referral code in the user table

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
