## ADDED Requirements

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
