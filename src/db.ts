import type { ImportCounts, NormalizedXtUser, SyncRunRecord, SyncStateRecord, SyncStateUpdate, UpsertResult, XtUserRecord } from "./types";

export interface XtDataStore {
  createSyncRun(input: { source: string; operation: string; cursorStart: string | null }): Promise<number>;
  finishSyncRun(runId: number, input: ImportCounts & { status: "success"; cursorEnd: string | null }): Promise<void>;
  failSyncRun(runId: number, input: Pick<ImportCounts, "processed" | "inserted" | "updated" | "skipped"> & { cursorEnd: string | null; errorMessage: string }): Promise<void>;
  upsertUser(user: NormalizedXtUser, runId: number, now: string): Promise<UpsertResult>;
  getLatestSyncRun(): Promise<SyncRunRecord | null>;
  getUserCount(): Promise<number>;
  listUsers(input: { limit: number; offset: number }): Promise<XtUserRecord[]>;
  getSyncState(operation: string): Promise<SyncStateRecord | null>;
  upsertSyncState(input: SyncStateUpdate): Promise<void>;
  resetSyncState(operation: string): Promise<void>;
}

export class D1XtDataStore implements XtDataStore {
  constructor(private readonly db: D1Database) {}

  async createSyncRun(input: { source: string; operation: string; cursorStart: string | null }): Promise<number> {
    const now = new Date().toISOString();
    const result = await this.db.prepare(
      `INSERT INTO sync_runs (
        source, operation, status, cursor_start, started_at
      ) VALUES (?, ?, 'running', ?, ?)`
    ).bind(input.source, input.operation, input.cursorStart, now).run();

    const id = result.meta.last_row_id;
    if (typeof id !== "number") {
      throw new Error("D1 did not return a sync run id");
    }
    return id;
  }

  async finishSyncRun(runId: number, input: ImportCounts & { status: "success"; cursorEnd: string | null }): Promise<void> {
    await this.db.prepare(
      `UPDATE sync_runs
       SET status = ?, cursor_end = ?, finished_at = ?, processed_count = ?,
           inserted_count = ?, updated_count = ?, skipped_count = ?, error_message = NULL
       WHERE id = ?`
    ).bind(
      input.status,
      input.cursorEnd,
      new Date().toISOString(),
      input.processed,
      input.inserted,
      input.updated,
      input.skipped,
      runId
    ).run();
  }

  async failSyncRun(runId: number, input: Pick<ImportCounts, "processed" | "inserted" | "updated" | "skipped"> & { cursorEnd: string | null; errorMessage: string }): Promise<void> {
    await this.db.prepare(
      `UPDATE sync_runs
       SET status = 'failed', cursor_end = ?, finished_at = ?, processed_count = ?,
           inserted_count = ?, updated_count = ?, skipped_count = ?, error_message = ?
       WHERE id = ?`
    ).bind(
      input.cursorEnd,
      new Date().toISOString(),
      input.processed,
      input.inserted,
      input.updated,
      input.skipped,
      input.errorMessage,
      runId
    ).run();
  }

  async upsertUser(user: NormalizedXtUser, runId: number, now: string): Promise<UpsertResult> {
    const existing = await this.db.prepare("SELECT uid FROM xt_users WHERE uid = ?").bind(user.uid).first<{ uid: string }>();

    if (!existing) {
      await this.db.prepare(
        `INSERT INTO xt_users (
          uid, affiliate_item_id, role, registered_at, first_seen_at, last_seen_at,
          last_sync_run_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        user.uid,
        user.affiliateItemId,
        user.role,
        user.registeredAt,
        now,
        now,
        runId,
        now,
        now
      ).run();
      return { inserted: true, updated: false };
    }

    await this.db.prepare(
      `UPDATE xt_users
       SET affiliate_item_id = ?, role = ?, registered_at = ?, last_seen_at = ?,
           last_sync_run_id = ?, updated_at = ?
       WHERE uid = ?`
    ).bind(
      user.affiliateItemId,
      user.role,
      user.registeredAt,
      now,
      runId,
      now,
      user.uid
    ).run();
    return { inserted: false, updated: true };
  }

  async getLatestSyncRun(): Promise<SyncRunRecord | null> {
    return await this.db.prepare(
      `SELECT id, source, operation, status, cursor_start, cursor_end, started_at,
              finished_at, processed_count, inserted_count, updated_count,
              skipped_count, error_message
       FROM sync_runs
       ORDER BY started_at DESC, id DESC
       LIMIT 1`
    ).first<SyncRunRecord>();
  }

  async getUserCount(): Promise<number> {
    const row = await this.db.prepare("SELECT COUNT(*) AS count FROM xt_users").first<{ count: number }>();
    return row?.count ?? 0;
  }

  async listUsers(input: { limit: number; offset: number }): Promise<XtUserRecord[]> {
    const result = await this.db.prepare(
      `SELECT uid, affiliate_item_id, role, registered_at, first_seen_at,
              last_seen_at, last_sync_run_id, created_at, updated_at
       FROM xt_users
       ORDER BY last_seen_at DESC, CAST(affiliate_item_id AS INTEGER) DESC
       LIMIT ? OFFSET ?`
    ).bind(input.limit, input.offset).all<XtUserRecord>();

    return result.results ?? [];
  }

  async getSyncState(operation: string): Promise<SyncStateRecord | null> {
    return await this.db.prepare(
      `SELECT operation, next_cursor, status, last_run_id, last_error,
              last_started_at, last_finished_at, updated_at
       FROM sync_state
       WHERE operation = ?`
    ).bind(operation).first<SyncStateRecord>();
  }

  async upsertSyncState(input: SyncStateUpdate): Promise<void> {
    const now = new Date().toISOString();
    await this.db.prepare(
      `INSERT INTO sync_state (
        operation, next_cursor, status, last_run_id, last_error,
        last_started_at, last_finished_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(operation) DO UPDATE SET
        next_cursor = excluded.next_cursor,
        status = excluded.status,
        last_run_id = excluded.last_run_id,
        last_error = excluded.last_error,
        last_started_at = COALESCE(excluded.last_started_at, sync_state.last_started_at),
        last_finished_at = COALESCE(excluded.last_finished_at, sync_state.last_finished_at),
        updated_at = excluded.updated_at`
    ).bind(
      input.operation,
      input.nextCursor,
      input.status,
      input.lastRunId,
      input.lastError,
      input.lastStartedAt ?? null,
      input.lastFinishedAt ?? null,
      now
    ).run();
  }

  async resetSyncState(operation: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.prepare(
      `INSERT INTO sync_state (
        operation, next_cursor, status, last_run_id, last_error,
        last_started_at, last_finished_at, updated_at
      ) VALUES (?, NULL, 'idle', NULL, NULL, NULL, NULL, ?)
      ON CONFLICT(operation) DO UPDATE SET
        next_cursor = NULL,
        status = 'idle',
        last_error = NULL,
        updated_at = excluded.updated_at`
    ).bind(operation, now).run();
  }
}
