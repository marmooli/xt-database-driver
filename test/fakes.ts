import type { XtDataStore } from "../src/db";
import type { ImportCounts, NormalizedXtUser, SyncRunRecord, SyncStateRecord, SyncStateUpdate, TradeBackfillProfile, UpsertResult, UserDailyTradeHistoryRow, UserListSort, UserReferralCodeFilter, UserTradeProfile, XtUserBalance, XtUserBalanceSnapshot, XtUserDailyTradeSnapshot, XtUserFeeSnapshot, XtUserInfo } from "../src/types";
import type { FetchAffiliateUsersParams, XtAffiliateUsersPage } from "../src/types";
import type { XtAffiliateUserSource } from "../src/xt-source";

export class FakeSource implements XtAffiliateUserSource {
  calls: FetchAffiliateUsersParams[] = [];

  constructor(private readonly pages: XtAffiliateUsersPage[]) {}

  async fetchAffiliateUsersPage(params: FetchAffiliateUsersParams): Promise<XtAffiliateUsersPage> {
    this.calls.push(params);
    const page = this.pages.shift();
    if (!page) return { hasNext: false, items: [] };
    return page;
  }
}

export class FakeStore implements XtDataStore {
  users = new Map<string, NormalizedXtUser & { firstSeenAt: string; lastSeenAt: string; runId: number }>();
  userInfos = new Map<string, XtUserInfo & { lastUserInfoSyncAt: string; runId: number }>();
  balances = new Map<string, XtUserBalance & { lastBalanceSyncAt: string; runId: number }>();
  snapshots = new Map<string, XtUserBalanceSnapshot & { runId: number }>();
  tradeSnapshots = new Map<string, XtUserDailyTradeSnapshot & { runId: number }>();
  feeSnapshots = new Map<string, XtUserFeeSnapshot & { runId: number }>();
  tradeSnapshotBatchSizes: number[] = [];
  feeSnapshotBatchSizes: number[] = [];
  runs: SyncRunRecord[] = [];
  states = new Map<string, SyncStateRecord>();
  nextRunId = 1;

  async createSyncRun(input: { source: string; operation: string; cursorStart: string | null }): Promise<number> {
    const id = this.nextRunId++;
    this.runs.push({
      id,
      source: input.source,
      operation: input.operation,
      status: "running",
      cursor_start: input.cursorStart,
      cursor_end: null,
      started_at: new Date().toISOString(),
      finished_at: null,
      processed_count: 0,
      inserted_count: 0,
      updated_count: 0,
      skipped_count: 0,
      error_message: null
    });
    return id;
  }

  async finishSyncRun(runId: number, input: ImportCounts & { status: "success"; cursorEnd: string | null }): Promise<void> {
    const run = this.requireRun(runId);
    run.status = input.status;
    run.cursor_end = input.cursorEnd;
    run.finished_at = new Date().toISOString();
    run.processed_count = input.processed;
    run.inserted_count = input.inserted;
    run.updated_count = input.updated;
    run.skipped_count = input.skipped;
  }

  async failSyncRun(runId: number, input: Pick<ImportCounts, "processed" | "inserted" | "updated" | "skipped"> & { cursorEnd: string | null; errorMessage: string }): Promise<void> {
    const run = this.requireRun(runId);
    run.status = "failed";
    run.cursor_end = input.cursorEnd;
    run.finished_at = new Date().toISOString();
    run.processed_count = input.processed;
    run.inserted_count = input.inserted;
    run.updated_count = input.updated;
    run.skipped_count = input.skipped;
    run.error_message = input.errorMessage;
  }

  async upsertUser(user: NormalizedXtUser, runId: number, now: string): Promise<UpsertResult> {
    const existing = this.users.get(user.uid);
    if (!existing) {
      this.users.set(user.uid, { ...user, firstSeenAt: now, lastSeenAt: now, runId });
      return { inserted: true, updated: false };
    }

    this.users.set(user.uid, { ...existing, ...user, firstSeenAt: existing.firstSeenAt, lastSeenAt: now, runId });
    return { inserted: false, updated: true };
  }

  async getLatestSyncRun(): Promise<SyncRunRecord | null> {
    return this.runs.at(-1) ?? null;
  }

  async getUserCount(): Promise<number> {
    return this.users.size;
  }

  async getReferralCodeCount(): Promise<number> {
    return new Set(
      Array.from(this.userInfos.values())
        .map((info) => info.registerInviteCode)
        .filter((code): code is string => Boolean(code))
    ).size;
  }

  async listUsers(input: { limit: number; offset: number; sort?: UserListSort; referralCodeFilter?: UserReferralCodeFilter | null }) {
    let rows = Array.from(this.users.entries());
    if (input.referralCodeFilter) {
      const filter = input.referralCodeFilter;
      const selected = new Set(filter.codes);
      rows = rows.filter(([uid]) => {
        const code = this.userInfos.get(uid)?.registerInviteCode ?? "";
        return code === ""
          ? filter.includeBlank
          : selected.has(code);
      });
    }
    if (input.sort === "balance_desc") {
      rows = rows.sort((a, b) => (this.balances.get(b[0])?.balance ?? -Infinity) - (this.balances.get(a[0])?.balance ?? -Infinity));
    }
    if (input.sort === "balance_asc") {
      rows = rows.sort((a, b) => (this.balances.get(a[0])?.balance ?? Infinity) - (this.balances.get(b[0])?.balance ?? Infinity));
    }
    if (input.sort === "trade_30d_desc") {
      rows = rows.sort((a, b) => this.tradeTotal(b[0]) - this.tradeTotal(a[0]));
    }
    if (input.sort === "registered_desc") {
      rows = rows.sort((a, b) => (b[1].registeredAt ?? -Infinity) - (a[1].registeredAt ?? -Infinity));
    }
    if (input.sort === "registered_asc") {
      rows = rows.sort((a, b) => (a[1].registeredAt ?? Infinity) - (b[1].registeredAt ?? Infinity));
    }
    return rows
      .slice(input.offset, input.offset + input.limit)
      .map(([uid, user]) => {
        const balance = this.balances.get(uid);
        return {
          uid,
          affiliate_item_id: user.affiliateItemId,
          role: user.role,
          register_invite_code: this.userInfos.get(uid)?.registerInviteCode ?? null,
          last_user_info_sync_at: this.userInfos.get(uid)?.lastUserInfoSyncAt ?? null,
          registered_at: user.registeredAt,
          first_seen_at: user.firstSeenAt,
          last_seen_at: user.lastSeenAt,
          last_sync_run_id: user.runId,
          created_at: user.firstSeenAt,
          updated_at: user.lastSeenAt,
          balance: balance?.balance ?? null,
          balance_text: balance?.balanceText ?? null,
          last_balance_sync_at: balance?.lastBalanceSyncAt ?? null,
          trade_30d_amount: this.tradeTotal(uid),
          trade_30d_amount_text: String(this.tradeTotal(uid))
        };
      });
  }

  async listReferralCodes(input: { limit: number; offset: number }): Promise<Array<{ code: string; users: number }>> {
    const grouped = new Map<string, number>();
    for (const info of this.userInfos.values()) {
      if (!info.registerInviteCode) continue;
      grouped.set(info.registerInviteCode, (grouped.get(info.registerInviteCode) ?? 0) + 1);
    }

    return Array.from(grouped.entries())
      .map(([code, users]) => ({ code, users }))
      .sort((a, b) => b.users - a.users || a.code.localeCompare(b.code))
      .slice(input.offset, input.offset + input.limit);
  }

  async getUserTradeProfile(uid: string): Promise<UserTradeProfile | null> {
    const user = this.users.get(uid);
    if (!user) return null;

    return {
      uid,
      registered_at: user.registeredAt,
      first_seen_at: user.firstSeenAt
    };
  }

  async getNextUserTradeProfile(afterUid: string | null): Promise<UserTradeProfile | null> {
    const uid = Array.from(this.users.keys())
      .sort((a, b) => Number(a) - Number(b))
      .find((candidate) => afterUid === null || Number(candidate) > Number(afterUid));
    return uid ? await this.getUserTradeProfile(uid) : null;
  }

  async getTradeBackfillProfile(uid: string): Promise<TradeBackfillProfile | null> {
    const user = this.users.get(uid);
    if (!user) return null;

    return {
      uid,
      registered_at: user.registeredAt,
      first_seen_at: user.firstSeenAt,
      cumulative_trade_amount: this.tradeTotal(uid),
      cumulative_trade_amount_text: String(this.tradeTotal(uid))
    };
  }

  async getNextTradeBackfillProfile(input: { afterTradeAmount: number | null; afterUid: string | null }): Promise<TradeBackfillProfile | null> {
    const candidates = Array.from(this.users.keys())
      .map((uid) => ({
        uid,
        user: this.users.get(uid)!,
        total: this.tradeTotal(uid)
      }))
      .sort((a, b) => b.total - a.total || Number(a.uid) - Number(b.uid));

    if (input.afterTradeAmount === null && input.afterUid === null) {
      const candidate = candidates[0];
      return candidate ? {
        uid: candidate.uid,
        registered_at: candidate.user.registeredAt,
        first_seen_at: candidate.user.firstSeenAt,
        cumulative_trade_amount: candidate.total,
        cumulative_trade_amount_text: String(candidate.total)
      } : null;
    }

    if (input.afterTradeAmount === null || input.afterUid === null) {
      return input.afterUid ? await this.getTradeBackfillProfile(input.afterUid) : null;
    }

    const candidate = candidates.find((entry) => entry.total < input.afterTradeAmount! || (entry.total === input.afterTradeAmount && Number(entry.uid) > Number(input.afterUid)));
    return candidate ? {
      uid: candidate.uid,
      registered_at: candidate.user.registeredAt,
      first_seen_at: candidate.user.firstSeenAt,
      cumulative_trade_amount: candidate.total,
      cumulative_trade_amount_text: String(candidate.total)
    } : null;
  }

  async listUserDailyTradeHistory(input: { uid: string; startDate: string; endDate: string }): Promise<UserDailyTradeHistoryRow[]> {
    return Array.from(this.tradeSnapshots.values())
      .filter((snapshot) => snapshot.uid === input.uid)
      .filter((snapshot) => snapshot.tradeDate >= input.startDate && snapshot.tradeDate <= input.endDate)
      .sort((a, b) => a.tradeDate.localeCompare(b.tradeDate))
      .map((snapshot) => ({
        trade_date: snapshot.tradeDate,
        trade_amount: snapshot.tradeAmount,
        trade_amount_text: snapshot.tradeAmountText
      }));
  }

  async listUserTradeSnapshotDates(input: { uid: string; startDate: string; endDate: string }): Promise<string[]> {
    return Array.from(this.tradeSnapshots.values())
      .filter((snapshot) => snapshot.uid === input.uid)
      .filter((snapshot) => snapshot.tradeDate >= input.startDate && snapshot.tradeDate <= input.endDate)
      .map((snapshot) => snapshot.tradeDate)
      .sort();
  }

  async listUserFeeSnapshotDates(input: { uid: string; startDate: string; endDate: string }): Promise<string[]> {
    return Array.from(this.feeSnapshots.values())
      .filter((snapshot) => snapshot.uid === input.uid)
      .filter((snapshot) => snapshot.feeDate >= input.startDate && snapshot.feeDate <= input.endDate)
      .map((snapshot) => snapshot.feeDate)
      .sort();
  }

  async listBalanceSyncCandidates(input: { limit: number }): Promise<string[]> {
    return Array.from(this.users.keys()).slice(0, input.limit);
  }

  async listUserInfoSyncCandidates(input: { limit: number }): Promise<string[]> {
    return Array.from(this.users.keys())
      .filter((uid) => !this.userInfos.has(uid))
      .sort((a, b) => {
        const aSynced = this.userInfos.has(a) ? 1 : 0;
        const bSynced = this.userInfos.has(b) ? 1 : 0;
        return aSynced - bSynced;
      })
      .slice(0, input.limit);
  }

  async getUserInfoPendingCount(): Promise<number> {
    return Array.from(this.users.keys()).filter((uid) => !this.userInfos.has(uid)).length;
  }

  async listBalanceSyncPage(input: { limit: number; afterUid: string | null }): Promise<string[]> {
    return await this.listUserUidPage(input);
  }

  async listUserUidPage(input: { limit: number; afterUid: string | null }): Promise<string[]> {
    return Array.from(this.users.keys())
      .sort((a, b) => Number(a) - Number(b))
      .filter((uid) => input.afterUid === null || Number(uid) > Number(input.afterUid))
      .slice(0, input.limit);
  }

  async upsertUserBalance(balance: XtUserBalance, runId: number, now: string): Promise<UpsertResult> {
    const existing = this.balances.has(balance.uid);
    this.balances.set(balance.uid, { ...balance, lastBalanceSyncAt: now, runId });
    return { inserted: !existing, updated: existing };
  }

  async upsertUserInfo(info: XtUserInfo, runId: number, now: string): Promise<UpsertResult> {
    if (!this.users.has(info.uid)) {
      return { inserted: false, updated: false };
    }

    const existing = this.userInfos.has(info.uid);
    this.userInfos.set(info.uid, { ...info, lastUserInfoSyncAt: now, runId });
    return { inserted: false, updated: !existing || existing };
  }

  async upsertUserBalanceSnapshot(snapshot: XtUserBalanceSnapshot, runId: number): Promise<UpsertResult> {
    const key = `${snapshot.uid}:${snapshot.snapshotDate}`;
    const existing = this.snapshots.has(key);
    this.snapshots.set(key, { ...snapshot, runId });
    return { inserted: !existing, updated: existing };
  }

  async upsertUserDailyTradeSnapshot(snapshot: XtUserDailyTradeSnapshot, runId: number, _now?: string): Promise<UpsertResult> {
    const [result] = await this.upsertUserDailyTradeSnapshots([snapshot], runId, _now);
    return result;
  }

  async upsertUserFeeSnapshot(snapshot: XtUserFeeSnapshot, runId: number, _now?: string): Promise<UpsertResult> {
    const [result] = await this.upsertUserFeeSnapshots([snapshot], runId, _now);
    return result;
  }

  async upsertUserDailyTradeSnapshots(snapshots: XtUserDailyTradeSnapshot[], runId: number, _now?: string): Promise<UpsertResult[]> {
    this.tradeSnapshotBatchSizes.push(snapshots.length);
    return snapshots.map((snapshot) => {
      const key = `${snapshot.uid}:${snapshot.tradeDate}`;
      const existing = this.tradeSnapshots.has(key);
      this.tradeSnapshots.set(key, { ...snapshot, runId });
      return { inserted: !existing, updated: existing };
    });
  }

  async upsertUserFeeSnapshots(snapshots: XtUserFeeSnapshot[], runId: number, _now?: string): Promise<UpsertResult[]> {
    this.feeSnapshotBatchSizes.push(snapshots.length);
    return snapshots.map((snapshot) => {
      const key = `${snapshot.uid}:${snapshot.feeDate}`;
      const existing = this.feeSnapshots.has(key);
      this.feeSnapshots.set(key, { ...snapshot, runId });
      return { inserted: !existing, updated: existing };
    });
  }

  async getSyncState(operation: string): Promise<SyncStateRecord | null> {
    return this.states.get(operation) ?? null;
  }

  async upsertSyncState(input: SyncStateUpdate): Promise<void> {
    const existing = this.states.get(input.operation);
    this.states.set(input.operation, {
      operation: input.operation,
      next_cursor: input.nextCursor,
      status: input.status,
      last_run_id: input.lastRunId,
      last_error: input.lastError,
      last_started_at: input.lastStartedAt ?? existing?.last_started_at ?? null,
      last_finished_at: input.lastFinishedAt ?? existing?.last_finished_at ?? null,
      updated_at: new Date().toISOString()
    });
  }

  async resetSyncState(operation: string): Promise<void> {
    const existing = this.states.get(operation);
    this.states.set(operation, {
      operation,
      next_cursor: null,
      status: "idle",
      last_run_id: existing?.last_run_id ?? null,
      last_error: null,
      last_started_at: existing?.last_started_at ?? null,
      last_finished_at: existing?.last_finished_at ?? null,
      updated_at: new Date().toISOString()
    });
  }

  private requireRun(runId: number): SyncRunRecord {
    const run = this.runs.find((candidate) => candidate.id === runId);
    if (!run) throw new Error(`Missing run ${runId}`);
    return run;
  }

  private tradeTotal(uid: string): number {
    return Array.from(this.tradeSnapshots.values())
      .filter((snapshot) => snapshot.uid === uid)
      .reduce((total, snapshot) => total + snapshot.tradeAmount, 0);
  }
}
