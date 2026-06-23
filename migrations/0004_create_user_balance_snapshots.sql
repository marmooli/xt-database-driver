CREATE TABLE IF NOT EXISTS xt_user_balance_snapshots (
  uid TEXT NOT NULL,
  snapshot_date TEXT NOT NULL,
  role TEXT,
  balance REAL NOT NULL,
  balance_text TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  sync_run_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (uid, snapshot_date),
  FOREIGN KEY (uid) REFERENCES xt_users(uid),
  FOREIGN KEY (sync_run_id) REFERENCES sync_runs(id)
) STRICT;

CREATE INDEX IF NOT EXISTS idx_xt_user_balance_snapshots_date
  ON xt_user_balance_snapshots (snapshot_date);

CREATE INDEX IF NOT EXISTS idx_xt_user_balance_snapshots_uid_date
  ON xt_user_balance_snapshots (uid, snapshot_date);
