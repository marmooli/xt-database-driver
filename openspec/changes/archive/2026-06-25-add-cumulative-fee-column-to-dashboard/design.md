## Context

The main dashboard already renders a user table from `/admin/users` with balance, registration, referral code, and 30-day trade volume columns. The database also stores daily fee snapshots per user in `xt_user_fee_daily_snapshots`, and the store layer already knows how to aggregate those snapshots for backfill and candidate selection. What is missing is exposure of that cumulative fee total in the main dashboard payload and UI.

## Goals / Non-Goals

**Goals:**
- Show a cumulative fee total for each user in the main dashboard table.
- Reuse fee data already stored in D1.
- Keep the change localized to the dashboard query, response shape, and table rendering.
- Avoid any new XT source calls or schema migrations.

**Non-Goals:**
- No new fee sync or backfill behavior.
- No new dashboard page or modal.
- No new sorting/filtering behavior for fee totals in this change.

## Decisions

1. **Compute cumulative fee in the existing dashboard query**
   The `listUsers()` query already performs a `LEFT JOIN` and `GROUP BY` for 30-day trade volume and balance data. The safest path is to add a cumulative fee aggregate to that same query so the dashboard gets one row per user with all required values in a single request. This keeps the UI simple and avoids an extra round trip per row.

   Alternatives considered:
   - Separate API call for fee totals per page. Rejected because it increases latency and makes the table harder to keep consistent.
   - Precompute a summary table. Rejected for now because the existing data volume and the current aggregate patterns are sufficient for this dashboard enhancement.

2. **Surface fee totals through the existing user record type**
   The API response should extend `XtUserRecord` with fee total fields so the dashboard can render the value without additional parsing logic. This keeps the front end aligned with the rest of the table columns, which already consume typed row data.

   Alternatives considered:
   - Embed the fee total only in a nested dashboard-specific payload. Rejected because it adds unnecessary shape divergence for a small extension.

3. **Add a dedicated fee column to the main table without changing existing behavior**
   The UI should render the new fee column alongside balance and 30-day trade volume, while keeping the current sort modes and filters unchanged. This minimizes user-facing surprise and reduces regression risk.

   Alternatives considered:
   - Make fee sortable immediately. Rejected because it increases scope without being required for the initial visibility win.

## Risks / Trade-offs

- [Aggregate query cost] → The main user query will compute one more `SUM(...)` aggregate per page. Mitigation: the dashboard is paginated and the project already uses similar aggregates for trade volume and backfill ordering.
- [Partial historical coverage] → Users without complete fee backfill will show lower cumulative totals. Mitigation: make the UI treat the value as "stored cumulative fee" and rely on the existing sync/backfill state to explain data completeness.
- [Visual clutter] → Adding another numeric column could compress smaller screens. Mitigation: keep the table responsive and reuse the existing compact table styling.

## Migration Plan

1. Update the data store query and typed record shape.
2. Update the dashboard table to render the new column.
3. Refresh or extend tests for the `/admin/users` payload and dashboard rendering.
4. Deploy normally.

Rollback is straightforward: remove the fee aggregate from the query and hide the column in the UI. No schema rollback is required.

## Open Questions

- Should fee totals be shown as a raw total only, or should we eventually add a 30-day fee view as well?
- Do we want fee sorting in a follow-up change once the column is visible?
