ALTER TABLE xt_users ADD COLUMN register_invite_code TEXT;
ALTER TABLE xt_users ADD COLUMN last_user_info_sync_at TEXT;

CREATE INDEX IF NOT EXISTS idx_xt_users_register_invite_code
  ON xt_users(register_invite_code);
