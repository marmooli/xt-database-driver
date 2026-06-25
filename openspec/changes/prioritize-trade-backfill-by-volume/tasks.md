## 1. Data Access and Cursor Model

- [x] 1.1 Add a cumulative trade-volume candidate query in the data store so historical trade backfill can select users by descending stored volume.
- [x] 1.2 Extend the trade backfill cursor/message shape so the next-user cursor can resume with both cumulative volume and UID.
- [x] 1.3 Keep the zero-volume and tie-break behavior deterministic.

## 2. Backfill Flow

- [x] 2.1 Update historical trade backfill start logic to seed the queue with the highest-volume user.
- [x] 2.2 Update backfill continuation logic to select the next user by cumulative volume rather than raw UID order.
- [x] 2.3 Preserve existing per-user day iteration, skip behavior, and snapshot idempotency.

## 3. Verification and Rollout

- [x] 3.1 Add tests covering prioritized ordering, tie-breaking, and zero-volume fallback.
- [x] 3.2 Add tests covering continuation across users with the new volume cursor.
- [x] 3.3 Run typecheck, unit tests, and a live verification against the deployed Worker.
