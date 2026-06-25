## ADDED Requirements

### Requirement: Dashboard displays cumulative fee totals
The dashboard SHALL display each user's cumulative fee total in the main UID table when fee snapshot data is available.

#### Scenario: Fee total data is available
- **WHEN** dashboard user rows include cumulative fee totals derived from stored fee snapshots
- **THEN** the dashboard SHALL show the fee total in the user table

#### Scenario: Fee total data is missing
- **WHEN** a user has no stored fee snapshots
- **THEN** the dashboard SHALL display a placeholder for the fee total instead of an incorrect value
