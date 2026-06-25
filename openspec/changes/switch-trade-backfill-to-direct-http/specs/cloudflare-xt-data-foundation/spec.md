## ADDED Requirements

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
