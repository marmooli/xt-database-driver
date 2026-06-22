## ADDED Requirements

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
