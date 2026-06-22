## Why

The remote production import proved that a full UID sync cannot safely run as one long Worker request. We need a scheduled, chunked sync path that keeps daily UID data fresh while staying within Cloudflare Worker execution limits.

## What Changes

- Add a scheduled Worker cron trigger for UID sync.
- Add durable sync cursor state so each scheduled run can resume from the previous chunk.
- Add a bounded chunk import mode for scheduled and manual operations.
- Add an admin endpoint to inspect and reset scheduled sync state.
- Keep sync focused on UID discovery data only; enrichment endpoints remain future phases.

## Capabilities

### New Capabilities

None.

### Modified Capabilities
- `cloudflare-xt-data-foundation`: Adds scheduled chunked UID sync behavior and durable cursor state.

## Impact

- Updates Worker config with a cron trigger.
- Adds a D1 migration for sync cursor state.
- Extends importer and admin endpoints for bounded scheduled sync.
- Adds tests for scheduled sync progression and state reset behavior.
