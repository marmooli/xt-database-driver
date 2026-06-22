## Context

UID import and dashboard listing are already deployed. `get_user_balance` returns a current numeric balance for one UID, so balance sync must be bounded and chunked to avoid long Worker requests.

## Goals / Non-Goals

**Goals:**

- Store the latest known balance per UID.
- Sync balances in bounded admin-triggered chunks.
- Sort dashboard users by balance.

**Non-Goals:**

- Balance history snapshots.
- Daily balance scheduling.
- Multi-currency balance breakdowns.

## Decisions

- Store current balance in `xt_user_balances` keyed by UID to keep financial enrichment separate from UID discovery.
- Use one protected bounded endpoint, `POST /admin/balances/sync`, to sync a small set of stale or missing balances.
- Return balance fields from `GET /admin/users` with `sort=balance_desc` and `sort=balance_asc`.

## Risks / Trade-offs

- Single-UID balance calls can be slow -> Keep sync bounded with `limit`.
- Balance is sensitive -> Keep endpoint protected by admin bearer token.
- Current balance is not history -> Add snapshot tables in a future phase if needed.
