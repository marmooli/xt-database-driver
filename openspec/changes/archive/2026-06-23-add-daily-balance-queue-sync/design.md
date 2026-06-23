## Design

The existing Worker cron runs once per day and already performs bounded UID sync. The new daily balance sync uses the same cron as a starter only. It writes `balance-daily-sync` state and enqueues the first Queue message.

The Queue consumer processes users in stable UID order. Each message syncs at most `BALANCE_SYNC_CHUNK_LIMIT` users, updates current balances in `xt_user_balances`, stores progress in `sync_state.next_cursor`, and enqueues the next message if more users remain.

This avoids a single long request for all balances while still producing a complete daily refresh after the queue drains.

## State

- Operation: `balance-daily-sync`
- `status = running`: daily queue work is in progress
- `next_cursor`: last processed UID while more chunks remain
- `status = success`: all imported UIDs were processed for the day
- `status = failed`: a chunk failed and the queue retry path did not complete the run

## Defaults

- Daily start uses the existing cron at `02:00 UTC`.
- Chunk size defaults to `100` and is configurable through `BALANCE_SYNC_CHUNK_LIMIT`.

