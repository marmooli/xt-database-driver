CREATE TABLE IF NOT EXISTS sync_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  operation TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed')),
  cursor_start TEXT,
  cursor_end TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  processed_count INTEGER NOT NULL DEFAULT 0,
  inserted_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT
) STRICT;

CREATE TABLE IF NOT EXISTS xt_users (
  uid TEXT PRIMARY KEY,
  affiliate_item_id TEXT,
  role TEXT,
  registered_at INTEGER,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  last_sync_run_id INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (last_sync_run_id) REFERENCES sync_runs(id)
) STRICT;

CREATE INDEX IF NOT EXISTS idx_xt_users_affiliate_item_id
  ON xt_users (affiliate_item_id);

CREATE INDEX IF NOT EXISTS idx_xt_users_last_seen_at
  ON xt_users (last_seen_at);

CREATE INDEX IF NOT EXISTS idx_sync_runs_started_at
  ON sync_runs (started_at);

CREATE INDEX IF NOT EXISTS idx_sync_runs_operation_started_at
  ON sync_runs (operation, started_at);
