import type { FeeBackfillProfile, ImportCounts, NormalizedXtUser, ReferralCodeRecord, SyncRunRecord, SyncStateRecord, SyncStateUpdate, TradeBackfillProfile, UpsertResult, UserDailyTradeHistoryRow, UserListSort, UserReferralCodeFilter, UserTradeProfile, XtUserBalance, XtUserBalanceSnapshot, XtUserDailyTradeSnapshot, XtUserFeeSnapshot, XtUserInfo, XtUserRecord } from "./types";

export interface XtDataStore {
  createSyncRun(input: { source: string; operation: string; cursorStart: string | null }): Promise<number>;
  finishSyncRun(runId: number, input: ImportCounts & { status: "success"; cursorEnd: string | null }): Promise<void>;
  failSyncRun(runId: number, input: Pick<ImportCounts, "processed" | "inserted" | "updated" | "skipped"> & { cursorEnd: string | null; errorMessage: string }): Promise<void>;
  upsertUser(user: NormalizedXtUser, runId: number, now: string): Promise<UpsertResult>;
  getLatestSyncRun(): Promise<SyncRunRecord | null>;
  getUserCount(): Promise<number>;
  listUsers(input: {
    limit: number;
    offset: number;
    sort: UserListSort;
    tradeDateStart: string;
    tradeDateEnd: string;
    referralCodeFilter: UserReferralCodeFilter | null;
  }): Promise<XtUserRecord[]>;
  getReferralCodeCount(): Promise<number>;
  listReferralCodes(input: { limit: number; offset: number }): Promise<ReferralCodeRecord[]>;
  getUserTradeProfile(uid: string): Promise<UserTradeProfile | null>;
  getNextUserTradeProfile(afterUid: string | null): Promise<UserTradeProfile | null>;
  getTradeBackfillProfile(uid: string): Promise<TradeBackfillProfile | null>;
  getNextTradeBackfillProfile(input: { afterTradeAmount: number | null; afterUid: string | null }): Promise<TradeBackfillProfile | null>;
  getFeeBackfillProfile(uid: string): Promise<FeeBackfillProfile | null>;
  getNextFeeBackfillProfile(input: { afterFeeAmount: number | null; afterUid: string | null }): Promise<FeeBackfillProfile | null>;
  listUserDailyTradeHistory(input: { uid: string; startDate: string; endDate: string }): Promise<UserDailyTradeHistoryRow[]>;
  listUserTradeSnapshotDates(input: { uid: string; startDate: string; endDate: string }): Promise<string[]>;
  listUserFeeSnapshotDates(input: { uid: string; startDate: string; endDate: string }): Promise<string[]>;
  getUserInfoPendingCount(): Promise<number>;
  listUserInfoSyncCandidates(input: { limit: number }): Promise<string[]>;
  listBalanceSyncCandidates(input: { limit: number }): Promise<string[]>;
  listBalanceSyncPage(input: { limit: number; afterUid: string | null }): Promise<string[]>;
  listUserUidPage(input: { limit: number; afterUid: string | null }): Promise<string[]>;
  upsertUserInfo(info: XtUserInfo, runId: number, now: string): Promise<UpsertResult>;
  upsertUserBalance(balance: XtUserBalance, runId: number, now: string): Promise<UpsertResult>;
  upsertUserBalanceSnapshot(snapshot: XtUserBalanceSnapshot, runId: number, now: string): Promise<UpsertResult>;
  upsertUserDailyTradeSnapshot(snapshot: XtUserDailyTradeSnapshot, runId: number, now: string): Promise<UpsertResult>;
  upsertUserDailyTradeSnapshots(snapshots: XtUserDailyTradeSnapshot[], runId: number, now: string): Promise<UpsertResult[]>;
  upsertUserFeeSnapshot(snapshot: XtUserFeeSnapshot, runId: number, now: string): Promise<UpsertResult>;
  upsertUserFeeSnapshots(snapshots: XtUserFeeSnapshot[], runId: number, now: string): Promise<UpsertResult[]>;
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

  async getReferralCodeCount(): Promise<number> {
    const row = await this.db.prepare(
      "SELECT COUNT(DISTINCT register_invite_code) AS count FROM xt_users WHERE register_invite_code IS NOT NULL AND register_invite_code <> ''"
    ).first<{ count: number }>();
    return row?.count ?? 0;
  }

  async listReferralCodes(input: { limit: number; offset: number }): Promise<ReferralCodeRecord[]> {
    const result = await this.db.prepare(
      `SELECT register_invite_code AS code, COUNT(*) AS users
       FROM xt_users
       WHERE register_invite_code IS NOT NULL AND register_invite_code <> ''
       GROUP BY register_invite_code
       ORDER BY users DESC, code ASC
       LIMIT ? OFFSET ?`
    ).bind(input.limit, input.offset).all<ReferralCodeRecord>();

    return result.results ?? [];
  }

  async getUserTradeProfile(uid: string): Promise<UserTradeProfile | null> {
    return await this.db.prepare(
      `SELECT uid, registered_at, first_seen_at
       FROM xt_users
       WHERE uid = ?`
    ).bind(uid).first<UserTradeProfile>();
  }

  async getTradeBackfillProfile(uid: string): Promise<TradeBackfillProfile | null> {
    return await this.db.prepare(
      `WITH user_totals AS (
         SELECT u.uid, u.registered_at, u.first_seen_at,
                ROUND(COALESCE(SUM(t.trade_amount), 0), 8) AS cumulative_trade_amount,
                CAST(ROUND(COALESCE(SUM(t.trade_amount), 0), 8) AS TEXT) AS cumulative_trade_amount_text
         FROM xt_users u
         LEFT JOIN xt_user_trade_daily_snapshots t
           ON t.uid = u.uid
         WHERE u.uid = ?
         GROUP BY u.uid, u.registered_at, u.first_seen_at
       )
       SELECT uid, registered_at, first_seen_at, cumulative_trade_amount, cumulative_trade_amount_text
       FROM user_totals`
    ).bind(uid).first<TradeBackfillProfile>();
  }

  async getNextTradeBackfillProfile(input: { afterTradeAmount: number | null; afterUid: string | null }): Promise<TradeBackfillProfile | null> {
    if (input.afterTradeAmount === null && input.afterUid === null) {
      return await this.db.prepare(
        `WITH user_totals AS (
           SELECT u.uid, u.registered_at, u.first_seen_at,
                  ROUND(COALESCE(SUM(t.trade_amount), 0), 8) AS cumulative_trade_amount,
                  CAST(ROUND(COALESCE(SUM(t.trade_amount), 0), 8) AS TEXT) AS cumulative_trade_amount_text
           FROM xt_users u
           LEFT JOIN xt_user_trade_daily_snapshots t
             ON t.uid = u.uid
           GROUP BY u.uid, u.registered_at, u.first_seen_at
         )
         SELECT uid, registered_at, first_seen_at, cumulative_trade_amount, cumulative_trade_amount_text
         FROM user_totals
         ORDER BY cumulative_trade_amount DESC, CAST(uid AS INTEGER) ASC
         LIMIT 1`
      ).first<TradeBackfillProfile>();
    }

    if (input.afterTradeAmount === null || input.afterUid === null) {
      return input.afterUid ? await this.getTradeBackfillProfile(input.afterUid) : null;
    }

    return await this.db.prepare(
      `WITH user_totals AS (
         SELECT u.uid, u.registered_at, u.first_seen_at,
                ROUND(COALESCE(SUM(t.trade_amount), 0), 8) AS cumulative_trade_amount,
                CAST(ROUND(COALESCE(SUM(t.trade_amount), 0), 8) AS TEXT) AS cumulative_trade_amount_text
         FROM xt_users u
         LEFT JOIN xt_user_trade_daily_snapshots t
           ON t.uid = u.uid
         GROUP BY u.uid, u.registered_at, u.first_seen_at
       )
       SELECT uid, registered_at, first_seen_at, cumulative_trade_amount, cumulative_trade_amount_text
       FROM user_totals
       WHERE cumulative_trade_amount < ?
          OR (cumulative_trade_amount = ? AND CAST(uid AS INTEGER) > CAST(? AS INTEGER))
       ORDER BY cumulative_trade_amount DESC, CAST(uid AS INTEGER) ASC
       LIMIT 1`
    ).bind(input.afterTradeAmount, input.afterTradeAmount, input.afterUid).first<TradeBackfillProfile>();
  }

  async getFeeBackfillProfile(uid: string): Promise<FeeBackfillProfile | null> {
    return await this.db.prepare(
      `SELECT uid, registered_at, first_seen_at,
              ROUND(COALESCE(SUM(f.fee), 0), 8) AS cumulative_fee,
              CAST(ROUND(COALESCE(SUM(f.fee), 0), 8) AS TEXT) AS cumulative_fee_text
       FROM xt_users u
       LEFT JOIN xt_user_fee_daily_snapshots f
         ON f.uid = u.uid
       WHERE u.uid = ?
       GROUP BY u.uid, u.registered_at, u.first_seen_at`
    ).bind(uid).first<FeeBackfillProfile>();
  }

  async getNextFeeBackfillProfile(input: { afterFeeAmount: number | null; afterUid: string | null }): Promise<FeeBackfillProfile | null> {
    if (input.afterFeeAmount === null && input.afterUid === null) {
      return await this.db.prepare(
        `WITH user_totals AS (
           SELECT u.uid, u.registered_at, u.first_seen_at,
                  ROUND(COALESCE(SUM(f.fee), 0), 8) AS cumulative_fee,
                  CAST(ROUND(COALESCE(SUM(f.fee), 0), 8) AS TEXT) AS cumulative_fee_text
           FROM xt_users u
           LEFT JOIN xt_user_fee_daily_snapshots f
             ON f.uid = u.uid
           GROUP BY u.uid, u.registered_at, u.first_seen_at
         )
         SELECT uid, registered_at, first_seen_at, cumulative_fee, cumulative_fee_text
         FROM user_totals
         ORDER BY cumulative_fee DESC, CAST(uid AS INTEGER) ASC
         LIMIT 1`
      ).first<FeeBackfillProfile>();
    }

    if (input.afterFeeAmount === null || input.afterUid === null) {
      return input.afterUid ? await this.getFeeBackfillProfile(input.afterUid) : null;
    }

    return await this.db.prepare(
      `WITH user_totals AS (
         SELECT u.uid, u.registered_at, u.first_seen_at,
                ROUND(COALESCE(SUM(f.fee), 0), 8) AS cumulative_fee,
                CAST(ROUND(COALESCE(SUM(f.fee), 0), 8) AS TEXT) AS cumulative_fee_text
         FROM xt_users u
         LEFT JOIN xt_user_fee_daily_snapshots f
           ON f.uid = u.uid
         GROUP BY u.uid, u.registered_at, u.first_seen_at
       )
       SELECT uid, registered_at, first_seen_at, cumulative_fee, cumulative_fee_text
       FROM user_totals
       WHERE cumulative_fee < ?
          OR (cumulative_fee = ? AND CAST(uid AS INTEGER) > CAST(? AS INTEGER))
       ORDER BY cumulative_fee DESC, CAST(uid AS INTEGER) ASC
       LIMIT 1`
    ).bind(input.afterFeeAmount, input.afterFeeAmount, input.afterUid).first<FeeBackfillProfile>();
  }

  async getNextUserTradeProfile(afterUid: string | null): Promise<UserTradeProfile | null> {
    const query = afterUid
      ? this.db.prepare(
        `SELECT uid, registered_at, first_seen_at
         FROM xt_users
         WHERE CAST(uid AS INTEGER) > CAST(? AS INTEGER)
         ORDER BY CAST(uid AS INTEGER) ASC
         LIMIT 1`
      ).bind(afterUid)
      : this.db.prepare(
        `SELECT uid, registered_at, first_seen_at
         FROM xt_users
         ORDER BY CAST(uid AS INTEGER) ASC
         LIMIT 1`
      );

    return await query.first<UserTradeProfile>();
  }

  async listUserDailyTradeHistory(input: { uid: string; startDate: string; endDate: string }): Promise<UserDailyTradeHistoryRow[]> {
    const result = await this.db.prepare(
      `SELECT trade_date, trade_amount, trade_amount_text
       FROM xt_user_trade_daily_snapshots
       WHERE uid = ?
         AND trade_date >= ?
         AND trade_date <= ?
       ORDER BY trade_date ASC`
    ).bind(input.uid, input.startDate, input.endDate).all<UserDailyTradeHistoryRow>();

    return result.results ?? [];
  }

  async listUserTradeSnapshotDates(input: { uid: string; startDate: string; endDate: string }): Promise<string[]> {
    const result = await this.db.prepare(
      `SELECT trade_date
       FROM xt_user_trade_daily_snapshots
       WHERE uid = ?
         AND trade_date >= ?
         AND trade_date <= ?
       ORDER BY trade_date ASC`
    ).bind(input.uid, input.startDate, input.endDate).all<{ trade_date: string }>();

    return (result.results ?? []).map((row) => row.trade_date);
  }

  async listUserFeeSnapshotDates(input: { uid: string; startDate: string; endDate: string }): Promise<string[]> {
    const result = await this.db.prepare(
      `SELECT fee_date
       FROM xt_user_fee_daily_snapshots
       WHERE uid = ?
         AND fee_date >= ?
         AND fee_date <= ?
       ORDER BY fee_date ASC`
    ).bind(input.uid, input.startDate, input.endDate).all<{ fee_date: string }>();

    return (result.results ?? []).map((row) => row.fee_date);
  }

  async listUsers(input: {
    limit: number;
    offset: number;
    sort: UserListSort;
    tradeDateStart: string;
    tradeDateEnd: string;
    referralCodeFilter: UserReferralCodeFilter | null;
  }): Promise<XtUserRecord[]> {
    const orderBy = input.sort === "balance_desc"
      ? "b.balance IS NULL ASC, b.balance DESC, u.last_seen_at DESC"
      : input.sort === "balance_asc"
        ? "b.balance IS NULL ASC, b.balance ASC, u.last_seen_at DESC"
        : input.sort === "trade_30d_desc"
          ? "trade_30d_amount DESC, u.last_seen_at DESC"
          : input.sort === "registered_desc"
            ? "u.registered_at IS NULL ASC, u.registered_at DESC, u.last_seen_at DESC"
            : input.sort === "registered_asc"
              ? "u.registered_at IS NULL ASC, u.registered_at ASC, u.last_seen_at DESC"
              : "u.last_seen_at DESC, CAST(u.affiliate_item_id AS INTEGER) DESC";
    const referralWhere = buildReferralCodeWhere(input.referralCodeFilter);
    const result = await this.db.prepare(
      `SELECT u.uid, u.affiliate_item_id, u.role, u.registered_at, u.first_seen_at,
              u.register_invite_code, u.last_user_info_sync_at, u.last_seen_at,
              u.last_sync_run_id, u.created_at, u.updated_at,
              b.balance, b.balance_text, b.last_balance_sync_at,
              COALESCE(SUM(t.trade_amount), 0) AS trade_30d_amount,
              CAST(COALESCE(SUM(t.trade_amount), 0) AS TEXT) AS trade_30d_amount_text
       FROM xt_users u
       LEFT JOIN xt_user_balances b ON b.uid = u.uid
       LEFT JOIN xt_user_trade_daily_snapshots t
         ON t.uid = u.uid
        AND t.trade_date >= ?
        AND t.trade_date <= ?
       ${referralWhere.sql}
       GROUP BY u.uid, u.affiliate_item_id, u.role, u.registered_at,
                u.register_invite_code, u.last_user_info_sync_at,
                u.first_seen_at, u.last_seen_at, u.last_sync_run_id,
                u.created_at, u.updated_at, b.balance, b.balance_text,
                b.last_balance_sync_at
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`
    ).bind(input.tradeDateStart, input.tradeDateEnd, ...referralWhere.bindings, input.limit, input.offset).all<XtUserRecord>();

    return result.results ?? [];
  }

  async listUserInfoSyncCandidates(input: { limit: number }): Promise<string[]> {
    const result = await this.db.prepare(
      `SELECT uid
       FROM xt_users
       WHERE last_user_info_sync_at IS NULL
       ORDER BY last_seen_at DESC, CAST(uid AS INTEGER) ASC
       LIMIT ?`
    ).bind(input.limit).all<{ uid: string }>();

    return (result.results ?? []).map((row) => row.uid);
  }

  async getUserInfoPendingCount(): Promise<number> {
    const row = await this.db.prepare(
      "SELECT COUNT(*) AS count FROM xt_users WHERE last_user_info_sync_at IS NULL"
    ).first<{ count: number }>();
    return row?.count ?? 0;
  }

  async listBalanceSyncCandidates(input: { limit: number }): Promise<string[]> {
    const result = await this.db.prepare(
      `SELECT u.uid
       FROM xt_users u
       LEFT JOIN xt_user_balances b ON b.uid = u.uid
       ORDER BY b.last_balance_sync_at IS NOT NULL ASC, b.last_balance_sync_at ASC, u.last_seen_at DESC
       LIMIT ?`
    ).bind(input.limit).all<{ uid: string }>();

    return (result.results ?? []).map((row) => row.uid);
  }

  async listBalanceSyncPage(input: { limit: number; afterUid: string | null }): Promise<string[]> {
    return await this.listUserUidPage(input);
  }

  async listUserUidPage(input: { limit: number; afterUid: string | null }): Promise<string[]> {
    const result = input.afterUid
      ? await this.db.prepare(
        `SELECT uid
         FROM xt_users
         WHERE CAST(uid AS INTEGER) > CAST(? AS INTEGER)
         ORDER BY CAST(uid AS INTEGER) ASC
         LIMIT ?`
      ).bind(input.afterUid, input.limit).all<{ uid: string }>()
      : await this.db.prepare(
        `SELECT uid
         FROM xt_users
         ORDER BY CAST(uid AS INTEGER) ASC
         LIMIT ?`
      ).bind(input.limit).all<{ uid: string }>();

    return (result.results ?? []).map((row) => row.uid);
  }

  async upsertUserInfo(info: XtUserInfo, _runId: number, now: string): Promise<UpsertResult> {
    const existing = await this.db.prepare("SELECT uid FROM xt_users WHERE uid = ?").bind(info.uid).first<{ uid: string }>();
    if (!existing) {
      return { inserted: false, updated: false };
    }

    await this.db.prepare(
      `UPDATE xt_users
       SET register_invite_code = ?, last_user_info_sync_at = ?, updated_at = ?
       WHERE uid = ?`
    ).bind(
      info.registerInviteCode,
      now,
      now,
      info.uid
    ).run();

    return { inserted: false, updated: true };
  }

  async upsertUserBalance(balance: XtUserBalance, runId: number, now: string): Promise<UpsertResult> {
    const existing = await this.db.prepare("SELECT uid FROM xt_user_balances WHERE uid = ?").bind(balance.uid).first<{ uid: string }>();

    if (!existing) {
      await this.db.prepare(
        `INSERT INTO xt_user_balances (
          uid, role, balance, balance_text, last_balance_sync_at,
          last_sync_run_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        balance.uid,
        balance.role,
        balance.balance,
        balance.balanceText,
        now,
        runId,
        now,
        now
      ).run();
      return { inserted: true, updated: false };
    }

    await this.db.prepare(
      `UPDATE xt_user_balances
       SET role = ?, balance = ?, balance_text = ?, last_balance_sync_at = ?,
           last_sync_run_id = ?, updated_at = ?
       WHERE uid = ?`
    ).bind(
      balance.role,
      balance.balance,
      balance.balanceText,
      now,
      runId,
      now,
      balance.uid
    ).run();
    return { inserted: false, updated: true };
  }

  async upsertUserBalanceSnapshot(snapshot: XtUserBalanceSnapshot, runId: number, now: string): Promise<UpsertResult> {
    const existing = await this.db.prepare(
      "SELECT uid FROM xt_user_balance_snapshots WHERE uid = ? AND snapshot_date = ?"
    ).bind(snapshot.uid, snapshot.snapshotDate).first<{ uid: string }>();

    if (!existing) {
      await this.db.prepare(
        `INSERT INTO xt_user_balance_snapshots (
          uid, snapshot_date, role, balance, balance_text, captured_at,
          sync_run_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        snapshot.uid,
        snapshot.snapshotDate,
        snapshot.role,
        snapshot.balance,
        snapshot.balanceText,
        snapshot.capturedAt,
        runId,
        now,
        now
      ).run();
      return { inserted: true, updated: false };
    }

    await this.db.prepare(
      `UPDATE xt_user_balance_snapshots
       SET role = ?, balance = ?, balance_text = ?, captured_at = ?,
           sync_run_id = ?, updated_at = ?
       WHERE uid = ? AND snapshot_date = ?`
    ).bind(
      snapshot.role,
      snapshot.balance,
      snapshot.balanceText,
      snapshot.capturedAt,
      runId,
      now,
      snapshot.uid,
      snapshot.snapshotDate
    ).run();
    return { inserted: false, updated: true };
  }

  async upsertUserDailyTradeSnapshot(snapshot: XtUserDailyTradeSnapshot, runId: number, now: string): Promise<UpsertResult> {
    const [result] = await this.upsertUserDailyTradeSnapshots([snapshot], runId, now);
    return result;
  }

  async upsertUserDailyTradeSnapshots(snapshots: XtUserDailyTradeSnapshot[], runId: number, now: string): Promise<UpsertResult[]> {
    if (snapshots.length === 0) {
      return [];
    }

    const existingKeys = await this.getExistingSnapshotKeys(
      "xt_user_trade_daily_snapshots",
      "trade_date",
      snapshots.map((snapshot) => [snapshot.uid, snapshot.tradeDate])
    );
    const statements: D1PreparedStatement[] = [];
    const results: UpsertResult[] = [];

    for (const snapshot of snapshots) {
      const existing = existingKeys.has(this.snapshotKey(snapshot.uid, snapshot.tradeDate));
      statements.push(existing
        ? this.db.prepare(
          `UPDATE xt_user_trade_daily_snapshots
           SET role = ?, trade = ?, trade_amount = ?, trade_amount_text = ?,
               source_start_ms = ?, source_end_ms = ?, captured_at = ?,
               sync_run_id = ?, updated_at = ?
           WHERE uid = ? AND trade_date = ?`
        ).bind(
          snapshot.role,
          snapshot.trade ? 1 : 0,
          snapshot.tradeAmount,
          snapshot.tradeAmountText,
          snapshot.sourceStartMs,
          snapshot.sourceEndMs,
          snapshot.capturedAt,
          runId,
          now,
          snapshot.uid,
          snapshot.tradeDate
        )
        : this.db.prepare(
          `INSERT INTO xt_user_trade_daily_snapshots (
            uid, trade_date, role, trade, trade_amount, trade_amount_text,
            source_start_ms, source_end_ms, captured_at, sync_run_id,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          snapshot.uid,
          snapshot.tradeDate,
          snapshot.role,
          snapshot.trade ? 1 : 0,
          snapshot.tradeAmount,
          snapshot.tradeAmountText,
          snapshot.sourceStartMs,
          snapshot.sourceEndMs,
          snapshot.capturedAt,
          runId,
          now,
          now
        ));
      results.push(existing ? { inserted: false, updated: true } : { inserted: true, updated: false });
    }

    await this.db.batch(statements);
    return results;
  }

  async upsertUserFeeSnapshot(snapshot: XtUserFeeSnapshot, runId: number, now: string): Promise<UpsertResult> {
    const [result] = await this.upsertUserFeeSnapshots([snapshot], runId, now);
    return result;
  }

  async upsertUserFeeSnapshots(snapshots: XtUserFeeSnapshot[], runId: number, now: string): Promise<UpsertResult[]> {
    if (snapshots.length === 0) {
      return [];
    }

    const existingKeys = await this.getExistingSnapshotKeys(
      "xt_user_fee_daily_snapshots",
      "fee_date",
      snapshots.map((snapshot) => [snapshot.uid, snapshot.feeDate])
    );
    const statements: D1PreparedStatement[] = [];
    const results: UpsertResult[] = [];

    for (const snapshot of snapshots) {
      const existing = existingKeys.has(this.snapshotKey(snapshot.uid, snapshot.feeDate));
      statements.push(existing
        ? this.db.prepare(
          `UPDATE xt_user_fee_daily_snapshots
           SET fee = ?, fee_text = ?, source_start_ms = ?, source_end_ms = ?,
               captured_at = ?, sync_run_id = ?, updated_at = ?
           WHERE uid = ? AND fee_date = ?`
        ).bind(
          snapshot.fee,
          snapshot.feeText,
          snapshot.sourceStartMs,
          snapshot.sourceEndMs,
          snapshot.capturedAt,
          runId,
          now,
          snapshot.uid,
          snapshot.feeDate
        )
        : this.db.prepare(
          `INSERT INTO xt_user_fee_daily_snapshots (
            uid, fee_date, fee, fee_text, source_start_ms, source_end_ms,
            captured_at, sync_run_id, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          snapshot.uid,
          snapshot.feeDate,
          snapshot.fee,
          snapshot.feeText,
          snapshot.sourceStartMs,
          snapshot.sourceEndMs,
          snapshot.capturedAt,
          runId,
          now,
          now
        ));
      results.push(existing ? { inserted: false, updated: true } : { inserted: true, updated: false });
    }

    await this.db.batch(statements);
    return results;
  }

  private async getExistingSnapshotKeys(
    table: "xt_user_trade_daily_snapshots" | "xt_user_fee_daily_snapshots",
    dateColumn: "trade_date" | "fee_date",
    keys: Array<[string, string]>
  ): Promise<Set<string>> {
    if (keys.length === 0) {
      return new Set();
    }

    const whereClause = keys.map(() => `(uid = ? AND ${dateColumn} = ?)`).join(" OR ");
    const result = await this.db.prepare(
      `SELECT uid, ${dateColumn} AS snapshot_date
       FROM ${table}
       WHERE ${whereClause}`
    ).bind(...keys.flatMap(([uid, snapshotDate]) => [uid, snapshotDate])).all<{ uid: string; snapshot_date: string }>();

    return new Set((result.results ?? []).map((row) => this.snapshotKey(row.uid, row.snapshot_date)));
  }

  private snapshotKey(uid: string, date: string): string {
    return `${uid}:${date}`;
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

function buildReferralCodeWhere(filter: UserReferralCodeFilter | null): { sql: string; bindings: string[] } {
  if (!filter) return { sql: "", bindings: [] };

  const clauses: string[] = [];
  const bindings: string[] = [];

  if (filter.codes.length > 0) {
    clauses.push(`u.register_invite_code IN (${filter.codes.map(() => "?").join(", ")})`);
    bindings.push(...filter.codes);
  }

  if (filter.includeBlank) {
    clauses.push("(u.register_invite_code IS NULL OR u.register_invite_code = '')");
  }

  return clauses.length > 0
    ? { sql: `WHERE (${clauses.join(" OR ")})`, bindings }
    : { sql: "WHERE 1 = 0", bindings };
}
