## 1. Storage

- [x] 1.1 Add D1 migration for `xt_user_balance_snapshots`.
- [x] 1.2 Add snapshot type and D1 upsert helper.

## 2. Daily Sync

- [x] 2.1 Compute daily `snapshot_date` with `Europe/Berlin`.
- [x] 2.2 Write snapshots only from `balance-daily-sync`.
- [x] 2.3 Keep manual balance sync from writing snapshots.

## 3. Verification

- [x] 3.1 Add tests for Germany-local date and snapshot upsert behavior.
- [x] 3.2 Run typecheck and tests.
- [x] 3.3 Apply migrations locally and remotely.
- [x] 3.4 Deploy and verify remote snapshot storage.
