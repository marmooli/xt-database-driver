import type { ImportCounts, NormalizedXtUser, SyncRunRecord, UpsertResult } from "./types";

export interface XtDataStore {
  createSyncRun(input: { source: string; operation: string; cursorStart: string | null }): Promise<number>;
  finishSyncRun(runId: number, input: ImportCounts & { status: "success"; cursorEnd: string | null }): Promise<void>;
  failSyncRun(runId: number, input: Pick<ImportCounts, "processed" | "inserted" | "updated" | "skipped"> & { cursorEnd: string | null; errorMessage: string }): Promise<void>;
  upsertUser(user: NormalizedXtUser, runId: number, now: string): Promise<UpsertResult>;
  getLatestSyncRun(): Promise<SyncRunRecord | null>;
  getUserCount(): Promise<number>;
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
}
