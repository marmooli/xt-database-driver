## Context

The Worker already exposes protected JSON endpoints for import status and scheduled sync state. The first dashboard should be operational rather than decorative: it needs to help inspect whether the data foundation is alive, how many UIDs are stored, and what the latest sync state is.

## Goals / Non-Goals

**Goals:**

- Serve a dashboard from the Worker at `/`.
- Authenticate dashboard API calls with the existing `ADMIN_IMPORT_TOKEN` bearer mechanism.
- Show core health/status data without adding a frontend build pipeline.
- List imported UID rows with pagination.
- Provide safe operational buttons for refresh, bounded import, and scheduled sync reset.

**Non-Goals:**

- Implement multi-user login, roles, or field-level permissions.
- Add editable user fields.
- Import or display sensitive profile/KYC/balance data.
- Add a separate frontend framework or deployment target.

## Decisions

### Serve static dashboard assets from the Worker

The dashboard can be a small HTML/CSS/JS document returned by the Worker. This avoids adding a frontend build step before requirements are mature.

Alternative considered: add a React app. That is reasonable later, but it would add tooling before the dashboard shape is proven.

### Keep token entry client-side for the first phase

The page stores the admin token in `sessionStorage` and uses it for API requests. This matches the existing bearer-token admin model and keeps the first dashboard small.

Alternative considered: cookie session auth. That is better for multi-user access, but belongs with the future role-based dashboard phase.

### Add a users list API

The dashboard needs more than aggregate status. A protected `GET /admin/users` endpoint returns paginated UID rows sorted by recent activity.

Alternative considered: query D1 directly outside the Worker. That would not give us the same auth and deployment model as the dashboard.

## Risks / Trade-offs

- Bearer token in browser session storage can be exposed by compromised browser context -> Keep dashboard minimal, no third-party scripts, and move to proper auth in a future phase.
- Large user lists can be slow -> Return bounded pages with a max limit.
- Operational buttons can trigger imports unintentionally -> Keep bounded import parameters and require the admin token.

## Migration Plan

1. Add D1 listing helper and protected `/admin/users` API.
2. Add dashboard HTML/CSS/JS served by the Worker.
3. Add tests for API protection and user listing.
4. Deploy and verify dashboard loads from the Worker URL.
