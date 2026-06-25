## Why

The historical trade-volume backfill can take a long time to complete across the full user base. We want the most valuable users to become available first, so the backlog should be processed in an order that reflects cumulative trade volume already stored in the database.

## What Changes

- Change historical trade backfill ordering so users with higher cumulative stored trade volume are processed before lower-volume users.
- Keep the existing backfill semantics intact: missing daily snapshots are still filled day by day, and existing snapshots are still skipped.
- Preserve queue-backed chunking and the current Germany-local date behavior.
- Keep the ordering deterministic for users with similar or missing cumulative volume.

## Capabilities

### Modified Capabilities

- `cloudflare-xt-data-foundation`: historical trade-volume backfill requirement changes from UID-ordered progression to volume-prioritized progression based on stored cumulative trade volume.

## Impact

- trade-history backfill job selection and next-user progression
- database queries used to choose the next backfill target
- tests covering backfill ordering and fallback behavior
- operational expectations for which users appear in trade history first
