## Why

The current heavy backfills for daily trade and fee history are correct but too slow for practical operation at the existing user count. We need a low-risk way to improve throughput without changing stored semantics or making the system brittle under load.

## What Changes

- Increase the safe chunk size for heavy backfill jobs in small, controlled steps.
- Prevent more than one heavy backfill from running at the same time.
- Keep daily syncs independent so routine refresh jobs can continue while a backfill is running.
- Reduce per-item overhead in backfill processing by grouping database writes where possible.
- Add a narrowly bounded amount of parallel XT fetching only where it can be verified as safe.
- Keep the existing data model and snapshot semantics unchanged.

## Capabilities

### New Capabilities
- `sync-throughput-guardrails`: operational guardrails for safer, faster backfill execution, including controlled chunk sizing and serialization of heavy backfills.

### Modified Capabilities
- `cloudflare-xt-data-foundation`: heavy backfill behavior now includes throughput guardrails so long-running trade and fee history backfills do not compete with each other, while preserving the existing daily sync semantics.

## Impact

- `src/trade-sync.ts`
- `src/fee-sync.ts`
- queue state and job-start logic for heavy backfills
- D1 write paths used by backfill chunk processors
- environment/config knobs for safe chunk limits and concurrency caps
- tests covering serialization, chunk sizing, and throughput-safe execution
