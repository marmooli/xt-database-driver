## Why

The historical fee backfill can take a long time across the full user base, and we want the highest-value users to become available first. We already learned from the trade-volume backfill that priority ordering, bounded chunking, and deterministic cursor behavior are important for making large historical jobs operationally useful.

## What Changes

- Change historical fee backfill ordering so users with higher cumulative stored fee values are processed before lower-fee users.
- Keep the existing historical fee semantics intact: missing daily fee snapshots are still filled day by day, and existing snapshots are still skipped.
- Preserve queue-backed chunking, Germany-local date handling, and durable cursor progression.
- Keep the ordering deterministic for users with equal or missing cumulative fee values.

## Capabilities

### Modified Capabilities

- `daily-fee-history`: historical fee backfill requirement changes from the current backfill progression to fee-prioritized progression based on stored cumulative fee.

## Impact

- fee-history backfill job selection and next-user progression
- database queries used to choose the next backfill target
- tests covering backfill ordering, tie-breaking, and zero-fee fallback
- operational expectations for which users appear in fee history first
