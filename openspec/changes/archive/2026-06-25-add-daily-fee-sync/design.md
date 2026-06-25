## Context

The XT proxy already exposes commission-level fee data through `get_user_commissions`, and the live test for UID `6636211405916` confirmed that the endpoint returns dated commission rows with `fee`, `commissionDate`, `commissionType`, `tradeType`, and `tradeVolume`. That gives us a stable source for daily fee history without relying on a new XT API shape.

The current project already has the D1, queue, and scheduled Worker patterns needed for daily balance and daily trade history. Fee history should follow the same operational model so it can be queried locally by the dashboard and later extended with charts or reporting.

## Goals / Non-Goals

**Goals:**
- Store one daily fee total per UID and Germany-local date.
- Sync the previous complete Germany day automatically.
- Backfill historical fee totals from each user's registration date through yesterday.
- Keep the sync bounded and resumable through queue chunks and durable state.

**Non-Goals:**
- Storing raw commission rows long-term.
- Splitting fee history into separate spot and futures tables in the first pass.
- Building dashboard UI for fee charts in this change.
- Reworking balance or trade sync behavior.

## Decisions

- Aggregate fee snapshots from `get_user_commissions` by `commissionDate` and sum all returned `fee` values for the same UID/day. This matches the user-visible need for daily totals and avoids an unnecessary raw-commission storage model.
- Reuse the existing daily trade and balance queue pattern for schedule/backfill orchestration. That keeps the operational shape familiar and minimizes new moving parts.
- Store fee snapshots at Germany-local day granularity, not UTC, so daily reports line up with the rest of the project's time model.
- Treat missing days as missing data rather than synthesizing zero values. That preserves the distinction between "no commission data was fetched" and "the fee total was actually zero."
- Use upsert semantics for snapshots so reruns update an existing row for the same UID/date instead of duplicating it.

## Risks / Trade-offs

- XT commission rows may arrive late or be revised after the daily sync runs → The daily job remains rerunnable, and the backfill can repair gaps or late arrivals.
- Some users may have many commission rows per day → Aggregating on the Worker side keeps storage small, but it adds per-day processing cost.
- Fee data may eventually need a spot/futures breakdown → The first model stores totals only, which is simpler now but leaves less detail for later analysis.
- Historical backfill can be long-running for large accounts → Chunked queue processing and durable cursors keep it resumable instead of forcing a single giant execution.

## Migration Plan

1. Add a new D1 table for daily fee snapshots and durable sync state.
2. Add the XT commission source parser and fee aggregation logic.
3. Add the daily scheduled fee sync and historical backfill queue flow.
4. Backfill historical fee history from registration date through yesterday.
5. Verify a sample UID against XT commissions and compare stored daily totals.

Rollback strategy:
- Stop the fee sync queue consumer and scheduler if needed.
- Leave already stored fee snapshot rows intact unless a data correction migration is explicitly required.
- Because the sync uses upserts, rerunning after rollback is safe once the issue is fixed.

## Open Questions

- Should fee snapshots later be exposed in the dashboard as a dedicated column or chart, or stay backend-only for now?
- Are there any commission currencies besides USDT that need normalization before aggregation?
