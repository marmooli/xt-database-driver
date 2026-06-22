## ADDED Requirements

### Requirement: Imported UID rows are listable by admins
The system SHALL expose a protected API for listing imported UID catalog rows.

#### Scenario: Admin lists imported UIDs
- **WHEN** an authorized admin requests imported UID rows
- **THEN** the system SHALL return a bounded page of UID rows sorted by recent activity

#### Scenario: Unauthorized user list request is rejected
- **WHEN** a user list request lacks valid admin authorization
- **THEN** the system SHALL reject the request without returning UID data
