## 1. Data Model

- [x] 1.1 Add a nullable trade backfill completion-date column to `xt_users`.
- [x] 1.2 Extend the store types and interfaces to read and write the completion marker.

## 2. Backfill Behavior

- [x] 2.1 Update historical trade backfill selection so users already complete through the current target date are skipped.
- [x] 2.2 Write the completion marker when a user finishes the current target date window.
- [x] 2.3 Preserve the existing priority ordering, day iteration, and snapshot idempotency.

## 3. Tests and Verification

- [x] 3.1 Add tests covering the skip of already-complete users.
- [x] 3.2 Add tests covering completion-marker writes and date-scoped eligibility.
- [x] 3.3 Run typecheck, unit tests, and a live verification against the deployed Worker.
