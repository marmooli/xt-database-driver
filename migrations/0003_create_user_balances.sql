CREATE TABLE IF NOT EXISTS xt_user_balances (
  uid TEXT PRIMARY KEY,
  role TEXT,
  balance REAL NOT NULL,
  balance_text TEXT NOT NULL,
  last_balance_sync_at TEXT NOT NULL,
  last_sync_run_id INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (uid) REFERENCES xt_users(uid),
  FOREIGN KEY (last_sync_run_id) REFERENCES sync_runs(id)
) STRICT;

CREATE INDEX IF NOT EXISTS idx_xt_user_balances_balance
  ON xt_user_balances (balance);

CREATE INDEX IF NOT EXISTS idx_xt_user_balances_last_sync
  ON xt_user_balances (last_balance_sync_at);
