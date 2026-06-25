## 1. Data Model and Source Plumbing

- [x] 1.1 Add D1 storage for daily fee snapshots and fee sync state.
- [x] 1.2 Add XT commission-source parsing and normalization for per-UID daily fee aggregation.
- [x] 1.3 Extend shared types and store interfaces for daily fee snapshot records and fee sync cursors.

## 2. Daily Sync and Backfill

- [x] 2.1 Implement the scheduled daily fee sync for the previous complete Germany-local day.
- [x] 2.2 Implement the bounded queue worker that writes one fee snapshot per UID and date.
- [x] 2.3 Implement the historical fee backfill from each user's registration date through yesterday.
- [x] 2.4 Make fee backfill skip dates that already have snapshots and continue across UIDs with durable cursors.
- [x] 2.5 Add protected admin endpoints for fee sync state inspection, start, and reset.

## 3. Verification and Docs

- [x] 3.1 Add tests for commission aggregation, snapshot upserts, and backfill continuation behavior.
- [x] 3.2 Update OpenSpec and project docs to describe the new fee history flow and operational endpoints.
- [x] 3.3 Verify a sample UID against XT commission data and compare stored daily fee totals after implementation.
