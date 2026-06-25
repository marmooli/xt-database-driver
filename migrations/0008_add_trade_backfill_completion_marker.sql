ALTER TABLE xt_users
  ADD COLUMN trade_backfill_completed_through_date TEXT;

CREATE INDEX IF NOT EXISTS idx_xt_users_trade_backfill_completed_through_date
  ON xt_users (trade_backfill_completed_through_date);
