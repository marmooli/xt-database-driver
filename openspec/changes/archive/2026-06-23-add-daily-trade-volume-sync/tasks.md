## 1. Storage and Source

- [x] 1.1 Add D1 migration for daily trade-volume snapshots.
- [x] 1.2 Add trade-volume response types and parser.
- [x] 1.3 Add MCP source support for `get_user_deposit_trading_data`.

## 2. Daily Sync

- [x] 2.1 Add Germany-local previous-day range helpers.
- [x] 2.2 Add daily trade sync orchestration and D1 state updates.
- [x] 2.3 Add dedicated Queue binding and Worker queue routing.
- [x] 2.4 Add protected admin status/start endpoints.

## 3. Verification

- [x] 3.1 Add tests for parsing, date ranges, chunk continuation, and endpoint auth.
- [x] 3.2 Run typecheck and tests.
- [x] 3.3 Apply migrations locally and remotely.
- [x] 3.4 Create/deploy required Cloudflare Queue resources.
- [x] 3.5 Deploy and verify remote daily trade sync.
