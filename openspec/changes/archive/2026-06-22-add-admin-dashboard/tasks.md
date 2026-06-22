## 1. Backend APIs

- [x] 1.1 Add D1 store helper for paginated imported UID listing.
- [x] 1.2 Add protected `GET /admin/users` endpoint with bounded limit and offset.

## 2. Dashboard UI

- [x] 2.1 Serve an admin dashboard page from `/`.
- [x] 2.2 Add token entry and session storage behavior.
- [x] 2.3 Display user count, latest run, scheduled state, and recent UID rows.
- [x] 2.4 Add refresh, bounded import, and scheduled reset actions.

## 3. Verification

- [x] 3.1 Add tests for user listing and protected dashboard APIs.
- [x] 3.2 Run typecheck and unit tests.
- [x] 3.3 Deploy Worker and verify the dashboard endpoint loads.
