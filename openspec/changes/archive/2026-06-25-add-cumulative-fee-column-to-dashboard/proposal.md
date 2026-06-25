## Why

The main dashboard already shows balance and 30-day trade volume, and the database now stores per-user daily fee snapshots that can be aggregated into a cumulative fee total. Adding the fee total to the main user table gives admins a complete at-a-glance view without requiring new XT calls.

## What Changes

- Add a cumulative fee column to the main dashboard user table.
- Populate that column from fee snapshots already stored in D1.
- Keep the existing dashboard layout and admin token flow intact.
- Preserve current sorting and filtering behavior unless it is explicitly extended later.

## Capabilities

### Modified Capabilities
- `admin-dashboard`: The main user table gains a new visible data column for cumulative fee totals.

## Impact

- `src/db.ts`: extend the dashboard user query to return cumulative fee totals.
- `src/types.ts`: add the fee total fields to the dashboard user record type.
- `src/dashboard.ts`: add the new table column and render the value.
- `src/http.ts`: keep the `/admin/users` response aligned with the updated record shape.
- `test/`: update dashboard and data-layer tests for the new column.
