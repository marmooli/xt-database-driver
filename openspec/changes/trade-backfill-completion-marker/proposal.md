## Why

The historical trade backfill currently keeps revisiting users whose daily trade snapshots are already complete for the current historical window. That wastes queue cycles and database reads even when no new data can be inserted. We need a simple, low-risk marker so already-complete users can be skipped instead of being reprocessed.

## What Changes

- Add a per-user trade backfill completion marker in the local database.
- Update historical trade backfill selection so users already complete through the current target date are skipped.
- Record when a user is fully complete through the current backfill window so the next chunk can move on immediately.
- Keep the existing day-by-day snapshot semantics, priority ordering, and idempotency intact.

## Capabilities

### Modified Capabilities

- `cloudflare-xt-data-foundation`: historical trade backfill behavior changes to skip users that are already complete through the current backfill target date and to persist a per-user completion marker.

## Impact

- trade-history backfill queue progression
- D1 schema for user completion tracking
- backfill selection queries and completion writes
- tests covering already-complete-user skipping and marker persistence
