## Why

The dashboard needs a first financial signal for prioritizing users. Current balance is the smallest useful enrichment to add before broader profile, trade, or commission data.

## What Changes

- Add current user balance storage in D1.
- Add a bounded admin balance sync endpoint.
- Show balance in the dashboard user table.
- Allow sorting users by balance ascending or descending.

## Capabilities

### New Capabilities

None.

### Modified Capabilities
- `cloudflare-xt-data-foundation`: Adds current balance enrichment for imported UIDs.
- `admin-dashboard`: Displays and sorts by current balance.

## Impact

- Adds a D1 migration for `xt_user_balances`.
- Extends XT MCP-over-HTTP source calls with `get_user_balance`.
- Extends protected admin APIs and dashboard UI.
