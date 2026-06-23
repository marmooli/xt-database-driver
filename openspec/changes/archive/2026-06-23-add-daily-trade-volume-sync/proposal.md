## Why

Admins need daily trade-volume history per user so later dashboard views can show user-level daily charts. The XT probe confirmed `get_user_deposit_trading_data` returns per-user trade amount for a bounded daily time range.

## What Changes

- Add a D1 table for daily user trade-volume snapshots.
- Add an XT MCP source adapter for `get_user_deposit_trading_data`.
- Start a daily trade-volume sync from the scheduled Worker event for the previous complete Germany-local day.
- Process users through a dedicated Cloudflare Queue in bounded chunks.
- Expose protected admin status/start endpoints for operational checks.

## Out of Scope

- Historical backfill from registration date to today.
- Dashboard charting or user drill-down views.
- Using `get_agent_user_trade_info`, which currently returned HTTP 400 during exploration.

