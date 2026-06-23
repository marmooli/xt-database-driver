import type { XtDataStore } from "./db";
import type { UserInfoBackfillSyncChunkResult, UserInfoBackfillSyncStartResult, UserInfoSyncQueueMessage, UserInfoSyncResult } from "./types";
import type { XtUserInfoSource } from "./xt-source";

export const USER_INFO_BACKFILL_SYNC_OPERATION = "user-info-backfill-sync";

export interface UserInfoSyncQueue {
  send(message: UserInfoSyncQueueMessage): Promise<unknown>;
}

export class UserInfoSyncer {
  constructor(
    private readonly source: XtUserInfoSource,
    private readonly store: XtDataStore,
    private readonly sourceName = "xt-mcp-http"
  ) {}

  async syncChunk(limit: number): Promise<UserInfoSyncResult> {
    const boundedLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
    const runId = await this.store.createSyncRun({
      source: this.sourceName,
      operation: "user-info-sync",
      cursorStart: null
    });
    const counts = { processed: 0, inserted: 0, updated: 0, skipped: 0 };

    try {
      const uids = await this.store.listUserInfoSyncCandidates({ limit: boundedLimit });
      const now = new Date().toISOString();

      for (const uid of uids) {
        counts.processed += 1;
        const info = await this.source.fetchUserInfo(uid);
        const result = await this.store.upsertUserInfo(info, runId, now);
        if (result.inserted) counts.inserted += 1;
        if (result.updated) counts.updated += 1;
        if (!result.inserted && !result.updated) counts.skipped += 1;
      }

      await this.store.finishSyncRun(runId, {
        status: "success",
        cursorEnd: null,
        ...counts
      });

      return { runId, status: "success", ...counts };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.store.failSyncRun(runId, {
        cursorEnd: null,
        errorMessage,
        ...counts
      });
      throw error;
    }
  }
}

export async function startUserInfoBackfillSync(input: {
  store: XtDataStore;
  queue: UserInfoSyncQueue;
  now?: Date;
}): Promise<UserInfoBackfillSyncStartResult> {
  const now = input.now ?? new Date();
  const state = await input.store.getSyncState(USER_INFO_BACKFILL_SYNC_OPERATION);

  if (state?.status === "running") {
    return { operation: USER_INFO_BACKFILL_SYNC_OPERATION, started: false, reason: "already-running" };
  }

  await input.store.upsertSyncState({
    operation: USER_INFO_BACKFILL_SYNC_OPERATION,
    nextCursor: null,
    status: "running",
    lastRunId: state?.last_run_id ?? null,
    lastError: null,
    lastStartedAt: now.toISOString(),
    lastFinishedAt: null
  });
  await input.queue.send({ startedAt: now.toISOString() });

  return { operation: USER_INFO_BACKFILL_SYNC_OPERATION, started: true, reason: "started" };
}

export class UserInfoBackfillSyncer {
  constructor(
    private readonly source: XtUserInfoSource,
    private readonly store: XtDataStore,
    private readonly queue: UserInfoSyncQueue,
    private readonly sourceName = "xt-mcp-http"
  ) {}

  async syncChunk(_message: UserInfoSyncQueueMessage, limit: number): Promise<UserInfoBackfillSyncChunkResult> {
    const boundedLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
    const runId = await this.store.createSyncRun({
      source: this.sourceName,
      operation: USER_INFO_BACKFILL_SYNC_OPERATION,
      cursorStart: null
    });
    const counts = { processed: 0, inserted: 0, updated: 0, skipped: 0 };

    try {
      const uids = await this.store.listUserInfoSyncCandidates({ limit: boundedLimit });
      const now = new Date().toISOString();

      for (const uid of uids) {
        counts.processed += 1;
        const info = await this.source.fetchUserInfo(uid);
        const result = await this.store.upsertUserInfo(info, runId, now);
        if (result.inserted) counts.inserted += 1;
        if (result.updated) counts.updated += 1;
        if (!result.inserted && !result.updated) counts.skipped += 1;
      }

      const exhausted = uids.length < boundedLimit;
      await this.store.finishSyncRun(runId, {
        status: "success",
        cursorEnd: null,
        ...counts
      });

      if (exhausted) {
        await this.store.upsertSyncState({
          operation: USER_INFO_BACKFILL_SYNC_OPERATION,
          nextCursor: null,
          status: "success",
          lastRunId: runId,
          lastError: null,
          lastFinishedAt: new Date().toISOString()
        });
      } else {
        await this.queue.send({ startedAt: now });
        await this.store.upsertSyncState({
          operation: USER_INFO_BACKFILL_SYNC_OPERATION,
          nextCursor: null,
          status: "running",
          lastRunId: runId,
          lastError: null
        });
      }

      return {
        operation: USER_INFO_BACKFILL_SYNC_OPERATION,
        runId,
        status: "success",
        exhausted,
        ...counts
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.store.failSyncRun(runId, {
        cursorEnd: null,
        errorMessage,
        ...counts
      });
      await this.store.upsertSyncState({
        operation: USER_INFO_BACKFILL_SYNC_OPERATION,
        nextCursor: null,
        status: "failed",
        lastRunId: runId,
        lastError: errorMessage,
        lastFinishedAt: new Date().toISOString()
      });
      throw error;
    }
  }
}
