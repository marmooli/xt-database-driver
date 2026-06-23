CREATE TABLE IF NOT EXISTS xt_user_trade_daily_snapshots (
  uid TEXT NOT NULL,
  trade_date TEXT NOT NULL,
  role TEXT,
  trade INTEGER NOT NULL CHECK (trade IN (0, 1)),
  trade_amount REAL NOT NULL,
  trade_amount_text TEXT NOT NULL,
  source_start_ms INTEGER NOT NULL,
  source_end_ms INTEGER NOT NULL,
  captured_at TEXT NOT NULL,
  sync_run_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (uid, trade_date),
  FOREIGN KEY (uid) REFERENCES xt_users(uid),
  FOREIGN KEY (sync_run_id) REFERENCES sync_runs(id)
) STRICT;

CREATE INDEX IF NOT EXISTS idx_xt_user_trade_daily_snapshots_date
  ON xt_user_trade_daily_snapshots (trade_date);

CREATE INDEX IF NOT EXISTS idx_xt_user_trade_daily_snapshots_amount
  ON xt_user_trade_daily_snapshots (trade_amount);
