CREATE TABLE IF NOT EXISTS sync_state (
  operation TEXT PRIMARY KEY,
  next_cursor TEXT,
  status TEXT NOT NULL CHECK (status IN ('idle', 'running', 'success', 'failed')),
  last_run_id INTEGER,
  last_error TEXT,
  last_started_at TEXT,
  last_finished_at TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (last_run_id) REFERENCES sync_runs(id)
) STRICT;

CREATE INDEX IF NOT EXISTS idx_sync_state_updated_at
  ON sync_state (updated_at);
