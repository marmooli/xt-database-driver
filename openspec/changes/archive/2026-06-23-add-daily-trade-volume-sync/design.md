## Design

The first trade-volume phase stores daily forward snapshots only. Each scheduled run targets the previous complete `Europe/Berlin` day to avoid partial same-day data.

The source is `get_user_deposit_trading_data`, called with:

- `uid`
- `startTime`: Germany-local day start converted to UTC milliseconds
- `endTime`: next Germany-local day start converted to UTC milliseconds

Snapshots are stored in `xt_user_trade_daily_snapshots` with a unique `(uid, trade_date)` key. Reprocessing the same UID/date updates the row rather than creating a duplicate.

Trade sync uses a dedicated Queue, `xt-trade-sync`, so balance and trade jobs can be retried and observed independently. The trade chunk default is intentionally smaller than balance sync because the verified XT trade call is slower.

## State

- Operation: `trade-daily-sync`
- `status = running`: queue chunks are still processing
- `next_cursor`: last processed UID
- `status = success`: all imported UIDs were processed for the trade date
- `status = failed`: a chunk failed
