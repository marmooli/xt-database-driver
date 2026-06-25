## 1. Priority Query and Cursor

- [x] 1.1 Add a cumulative-fee candidate query in the fee data store so historical backfill can select users by descending fee totals derived from stored daily fee snapshots.
- [x] 1.2 Extend the fee backfill cursor/message shape so the next-user cursor can resume with both cumulative fee and UID.
- [x] 1.3 Keep the zero-fee and tie-break behavior deterministic.

## 2. Backfill Ordering

- [x] 2.1 Update historical fee backfill start logic to seed the queue with the highest-fee user.
- [x] 2.2 Update backfill continuation logic to select the next user by cumulative fee rather than raw UID order.
- [x] 2.3 Preserve existing per-user day iteration, skip behavior, and snapshot idempotency.

## 3. Tests and Verification

- [x] 3.1 Add tests covering prioritized ordering, tie-breaking, and zero-fee fallback.
- [x] 3.2 Add tests covering continuation across users with the new fee cursor.
- [x] 3.3 Run typecheck, unit tests, and a live verification against the deployed Worker.
