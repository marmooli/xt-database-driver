## Why

Operators currently need curl commands to inspect UID sync status and trigger maintenance actions. A small protected dashboard will make the Cloudflare D1 foundation visible and usable before richer user-data phases begin.

## What Changes

- Add a protected browser dashboard served by the Worker.
- Add an admin users API for listing imported UID rows.
- Display user count, latest import run, scheduled sync state, and recent users.
- Provide dashboard actions for refresh, bounded UID import, and scheduled sync reset.
- Keep authentication token-based for this phase; role-based dashboard access remains future work.

## Capabilities

### New Capabilities
- `admin-dashboard`: Defines the initial protected dashboard for XT D1 operational data.

### Modified Capabilities
- `cloudflare-xt-data-foundation`: Adds read APIs needed by the dashboard to inspect imported users.

## Impact

- Worker serves HTML/CSS/JS for the dashboard.
- D1 store gains paginated user listing.
- Admin API adds a protected user list endpoint.
- Tests cover protected dashboard APIs and user listing.
