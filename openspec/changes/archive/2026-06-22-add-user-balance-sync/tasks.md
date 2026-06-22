## 1. Storage and Source

- [x] 1.1 Add D1 migration for `xt_user_balances`.
- [x] 1.2 Add MCP-over-HTTP source support for `get_user_balance`.
- [x] 1.3 Add D1 helpers for balance sync candidates and upsert.

## 2. API and Dashboard

- [x] 2.1 Add protected `POST /admin/balances/sync` endpoint.
- [x] 2.2 Add balance fields and balance sorting to `GET /admin/users`.
- [x] 2.3 Show balance and balance sort controls in the dashboard.

## 3. Verification

- [x] 3.1 Add tests for balance parsing, user sorting, and endpoint auth.
- [x] 3.2 Run typecheck and tests.
- [x] 3.3 Apply migrations locally and remotely.
- [x] 3.4 Deploy and verify remote balance sync and sorting.
