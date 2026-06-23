import type { XtDataStore } from "./db";
import type { BalanceSyncQueueMessage, BalanceSyncResult, DailyBalanceSyncChunkResult, DailyBalanceSyncStartResult } from "./types";
import type { XtUserBalanceSource } from "./xt-source";

export const BALANCE_DAILY_SYNC_OPERATION = "balance-daily-sync";

export interface BalanceSyncQueue {
  send(message: BalanceSyncQueueMessage): Promise<unknown>;
}

export class BalanceSyncer {
  constructor(
    private readonly source: XtUserBalanceSource,
    private readonly store: XtDataStore,
    private readonly sourceName = "xt-mcp-http"
  ) {}

  async syncChunk(limit: number): Promise<BalanceSyncResult> {
    const boundedLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
    const runId = await this.store.createSyncRun({
      source: this.sourceName,
      operation: "balance-sync",
      cursorStart: null
    });
    const counts = { processed: 0, inserted: 0, updated: 0, skipped: 0 };

    try {
      const uids = await this.store.listBalanceSyncCandidates({ limit: boundedLimit });
      const now = new Date().toISOString();

      for (const uid of uids) {
        counts.processed += 1;
        const balance = await this.source.fetchUserBalance(uid);
        const result = await this.store.upsertUserBalance(balance, runId, now);
        if (result.inserted) counts.inserted += 1;
        if (result.updated) counts.updated += 1;
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

export async function startDailyBalanceSync(input: {
  store: XtDataStore;
  queue: BalanceSyncQueue;
  now?: Date;
}): Promise<DailyBalanceSyncStartResult> {
  const now = input.now ?? new Date();
  const syncDate = toUtcDate(now);
  const state = await input.store.getSyncState(BALANCE_DAILY_SYNC_OPERATION);

  if (state?.status === "running" && state.last_started_at?.startsWith(syncDate)) {
    return { operation: BALANCE_DAILY_SYNC_OPERATION, syncDate, started: false, reason: "already-running" };
  }

  if (state?.status === "success" && state.last_started_at?.startsWith(syncDate)) {
    return { operation: BALANCE_DAILY_SYNC_OPERATION, syncDate, started: false, reason: "already-complete" };
  }

  await input.store.upsertSyncState({
    operation: BALANCE_DAILY_SYNC_OPERATION,
    nextCursor: null,
    status: "running",
    lastRunId: state?.last_run_id ?? null,
    lastError: null,
    lastStartedAt: now.toISOString(),
    lastFinishedAt: null
  });
  await input.queue.send({ syncDate });

  return { operation: BALANCE_DAILY_SYNC_OPERATION, syncDate, started: true, reason: "started" };
}

export class DailyBalanceSyncer {
  constructor(
    private readonly source: XtUserBalanceSource,
    private readonly store: XtDataStore,
    private readonly queue: BalanceSyncQueue,
    private readonly sourceName = "xt-mcp-http"
  ) {}

  async syncChunk(message: BalanceSyncQueueMessage, limit: number): Promise<DailyBalanceSyncChunkResult> {
    const boundedLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
    const cursorStart = message.afterUid ?? null;
    const runId = await this.store.createSyncRun({
      source: this.sourceName,
      operation: BALANCE_DAILY_SYNC_OPERATION,
      cursorStart
    });
    const counts = { processed: 0, inserted: 0, updated: 0, skipped: 0 };

    try {
      const uids = await this.store.listBalanceSyncPage({ limit: boundedLimit, afterUid: cursorStart });
      const now = new Date().toISOString();
      let cursorEnd = cursorStart;

      for (const uid of uids) {
        counts.processed += 1;
        cursorEnd = uid;
        const balance = await this.source.fetchUserBalance(uid);
        const result = await this.store.upsertUserBalance(balance, runId, now);
        if (result.inserted) counts.inserted += 1;
        if (result.updated) counts.updated += 1;
      }

      const exhausted = uids.length < boundedLimit;
      await this.store.finishSyncRun(runId, {
        status: "success",
        cursorEnd,
        ...counts
      });

      if (exhausted) {
        await this.store.upsertSyncState({
          operation: BALANCE_DAILY_SYNC_OPERATION,
          nextCursor: null,
          status: "success",
          lastRunId: runId,
          lastError: null,
          lastFinishedAt: new Date().toISOString()
        });
      } else {
        await this.queue.send({ syncDate: message.syncDate, afterUid: cursorEnd });
        await this.store.upsertSyncState({
          operation: BALANCE_DAILY_SYNC_OPERATION,
          nextCursor: cursorEnd,
          status: "running",
          lastRunId: runId,
          lastError: null
        });
      }

      return {
        operation: BALANCE_DAILY_SYNC_OPERATION,
        syncDate: message.syncDate,
        runId,
        status: "success",
        cursorStart,
        cursorEnd,
        exhausted,
        ...counts
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.store.failSyncRun(runId, {
        cursorEnd: cursorStart,
        errorMessage,
        ...counts
      });
      await this.store.upsertSyncState({
        operation: BALANCE_DAILY_SYNC_OPERATION,
        nextCursor: cursorStart,
        status: "failed",
        lastRunId: runId,
        lastError: errorMessage,
        lastFinishedAt: new Date().toISOString()
      });
      throw error;
    }
  }
}

function toUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
