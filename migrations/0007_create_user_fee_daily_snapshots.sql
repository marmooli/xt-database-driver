CREATE TABLE IF NOT EXISTS xt_user_fee_daily_snapshots (
  uid TEXT NOT NULL,
  fee_date TEXT NOT NULL,
  fee REAL NOT NULL,
  fee_text TEXT NOT NULL,
  source_start_ms INTEGER NOT NULL,
  source_end_ms INTEGER NOT NULL,
  captured_at TEXT NOT NULL,
  sync_run_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (uid, fee_date),
  FOREIGN KEY (uid) REFERENCES xt_users(uid),
  FOREIGN KEY (sync_run_id) REFERENCES sync_runs(id)
) STRICT;

CREATE INDEX IF NOT EXISTS idx_xt_user_fee_daily_snapshots_date
  ON xt_user_fee_daily_snapshots (fee_date);

CREATE INDEX IF NOT EXISTS idx_xt_user_fee_daily_snapshots_uid_date
  ON xt_user_fee_daily_snapshots (uid, fee_date);
