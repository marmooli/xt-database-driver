import type { XtDataStore } from "../src/db";
import type { ImportCounts, NormalizedXtUser, SyncRunRecord, UpsertResult } from "../src/types";
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
  runs: SyncRunRecord[] = [];
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

  private requireRun(runId: number): SyncRunRecord {
    const run = this.runs.find((candidate) => candidate.id === runId);
    if (!run) throw new Error(`Missing run ${runId}`);
    return run;
  }
}
