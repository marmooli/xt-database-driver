## Why

The current balance table stores only the latest known balance per UID. Admin review also needs a daily balance history so each user can be inspected over time.

## What Changes

- Add a D1 table for daily user balance snapshots.
- Store one snapshot per UID per Germany-local date from the daily balance job.
- Keep manual balance sync from writing daily history.
- Use `Europe/Berlin` for project business dates such as `snapshot_date`.

## Out of Scope

- Backfilling historical balances for past days.
- Filling missing days with zero or previous balances.
- Dashboard charting for balance history.

