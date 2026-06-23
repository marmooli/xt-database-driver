import type { XtDataStore } from "../src/db";
import type { ImportCounts, NormalizedXtUser, SyncRunRecord, SyncStateRecord, SyncStateUpdate, UpsertResult, UserListSort, XtUserBalance } from "../src/types";
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
  balances = new Map<string, XtUserBalance & { lastBalanceSyncAt: string; runId: number }>();
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

  async listUsers(input: { limit: number; offset: number; sort?: UserListSort }) {
    let rows = Array.from(this.users.entries());
    if (input.sort === "balance_desc") {
      rows = rows.sort((a, b) => (this.balances.get(b[0])?.balance ?? -Infinity) - (this.balances.get(a[0])?.balance ?? -Infinity));
    }
    if (input.sort === "balance_asc") {
      rows = rows.sort((a, b) => (this.balances.get(a[0])?.balance ?? Infinity) - (this.balances.get(b[0])?.balance ?? Infinity));
    }
    return rows
      .slice(input.offset, input.offset + input.limit)
      .map(([uid, user]) => {
        const balance = this.balances.get(uid);
        return {
          uid,
          affiliate_item_id: user.affiliateItemId,
          role: user.role,
          registered_at: user.registeredAt,
          first_seen_at: user.firstSeenAt,
          last_seen_at: user.lastSeenAt,
          last_sync_run_id: user.runId,
          created_at: user.firstSeenAt,
          updated_at: user.lastSeenAt,
          balance: balance?.balance ?? null,
          balance_text: balance?.balanceText ?? null,
          last_balance_sync_at: balance?.lastBalanceSyncAt ?? null
        };
      });
  }

  async listBalanceSyncCandidates(input: { limit: number }): Promise<string[]> {
    return Array.from(this.users.keys()).slice(0, input.limit);
  }

  async listBalanceSyncPage(input: { limit: number; afterUid: string | null }): Promise<string[]> {
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
}
