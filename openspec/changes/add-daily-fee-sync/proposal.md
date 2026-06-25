## Why

We now know that XT exposes per-user commission rows through `get_user_commissions`, including a `fee` value and `commissionDate`. That makes it practical to build a local daily fee history, which we need for dashboard trends, user-level analysis, and future reporting without relying on live XT calls each time.

## What Changes

- Add a new daily fee history capability that stores one fee total per UID per Germany-local day.
- Add a scheduled daily fee sync that captures the previous complete Germany-local day.
- Add a historical fee backfill that fills fee history from each user's registration date through yesterday.
- Reuse the existing D1-backed sync patterns, queue orchestration, and admin protection model already used for trade and balance history.
- Keep missing days empty rather than synthesizing fee values.
- Store one aggregated fee total per day rather than separate spot and futures history in the first pass.

## Capabilities

### New Capabilities
- `daily-fee-history`: daily fee snapshots, daily sync, historical backfill, and durable sync state for per-user fee totals

### Modified Capabilities
- None

## Impact

- Cloudflare D1 schema for a new fee snapshot table and sync state entries.
- Cloudflare Queue and Worker scheduling for daily fee sync and historical fee backfill.
- XT MCP usage of `get_user_commissions` as the source for fee totals.
- Later dashboard and analytics views that will consume fee history without additional XT calls.
