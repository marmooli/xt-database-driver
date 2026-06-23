## Design

Daily balance history is stored in `xt_user_balance_snapshots`. The unique key is `(uid, snapshot_date)`, where `snapshot_date` is the Germany-local date for the daily job.

Only `balance-daily-sync` writes snapshots. The existing manual `balance-sync` endpoint continues to update `xt_user_balances` but does not write history, because manual refreshes should not become the canonical daily value.

When a daily job processes the same UID more than once for the same Germany-local date, the snapshot row is updated rather than duplicated.

If a UID is not reached by the daily job on a date, no snapshot row is created for that UID/date.

