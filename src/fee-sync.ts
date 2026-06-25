import type { XtDataStore } from "./db";
import type { DailyFeeSyncChunkResult, DailyFeeSyncStartResult, FeeBackfillProfile, FeeBackfillSyncChunkResult, FeeBackfillSyncQueueMessage, FeeBackfillSyncStartResult, FeeSyncQueueMessage, XtUserFeeSnapshot } from "./types";
import type { XtUserFeeSource } from "./xt-source";
import { addDaysToDateString, germanyDateRangeToUtcMs, previousGermanyDate, toGermanyDate } from "./trade-sync";
import { canStartHeavyBackfill, clampHeavyBackfillDayLimit, clampHeavyBackfillFetchConcurrency, mapWithConcurrency } from "./heavy-backfill";

export const FEE_DAILY_SYNC_OPERATION = "fee-daily-sync";
export const FEE_BACKFILL_SYNC_OPERATION = "fee-history-backfill-sync";

export interface FeeSyncQueue {
  send(message: FeeSyncQueueMessage): Promise<unknown>;
}

export interface FeeBackfillSyncQueue {
  send(message: FeeBackfillSyncQueueMessage): Promise<unknown>;
}

export async function startDailyFeeSync(input: {
  store: XtDataStore;
  queue: FeeSyncQueue;
  now?: Date;
}): Promise<DailyFeeSyncStartResult> {
  const now = input.now ?? new Date();
  const runDate = toGermanyDate(now);
  const feeDate = previousGermanyDate(now);
  const range = germanyDateRangeToUtcMs(feeDate);
  const state = await input.store.getSyncState(FEE_DAILY_SYNC_OPERATION);
  const stateStartedGermanyDate = state?.last_started_at ? toGermanyDate(new Date(state.last_started_at)) : null;

  if (state?.status === "running" && stateStartedGermanyDate === runDate) {
    return { operation: FEE_DAILY_SYNC_OPERATION, feeDate, started: false, reason: "already-running" };
  }

  if (state?.status === "success" && stateStartedGermanyDate === runDate) {
    return { operation: FEE_DAILY_SYNC_OPERATION, feeDate, started: false, reason: "already-complete" };
  }

  await input.store.upsertSyncState({
    operation: FEE_DAILY_SYNC_OPERATION,
    nextCursor: null,
    status: "running",
    lastRunId: state?.last_run_id ?? null,
    lastError: null,
    lastStartedAt: now.toISOString(),
    lastFinishedAt: null
  });
  await input.queue.send({
    feeDate,
    sourceStartMs: range.sourceStartMs,
    sourceEndMs: range.sourceEndMs
  });

  return { operation: FEE_DAILY_SYNC_OPERATION, feeDate, started: true, reason: "started" };
}

export class DailyFeeSyncer {
  constructor(
    private readonly source: XtUserFeeSource,
    private readonly store: XtDataStore,
    private readonly queue: FeeSyncQueue,
    private readonly sourceName = "xt-mcp-http"
  ) {}

  async syncChunk(message: FeeSyncQueueMessage, limit: number): Promise<DailyFeeSyncChunkResult> {
    const boundedLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
    const cursorStart = message.afterUid ?? null;
    const runId = await this.store.createSyncRun({
      source: this.sourceName,
      operation: FEE_DAILY_SYNC_OPERATION,
      cursorStart
    });
    const counts = { processed: 0, inserted: 0, updated: 0, skipped: 0 };

    try {
      const uids = await this.store.listUserUidPage({ limit: boundedLimit, afterUid: cursorStart });
      const now = new Date().toISOString();
      let cursorEnd = cursorStart;

      for (const uid of uids) {
        counts.processed += 1;
        cursorEnd = uid;
        const fee = await this.source.fetchUserDailyFee({
          uid,
          feeDate: message.feeDate,
          sourceStartMs: message.sourceStartMs,
          sourceEndMs: message.sourceEndMs
        });

        if (!fee) {
          counts.skipped += 1;
          continue;
        }

        const result = await this.store.upsertUserFeeSnapshot({
          ...fee,
          feeDate: message.feeDate,
          sourceStartMs: message.sourceStartMs,
          sourceEndMs: message.sourceEndMs,
          capturedAt: now
        }, runId, now);
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
          operation: FEE_DAILY_SYNC_OPERATION,
          nextCursor: null,
          status: "success",
          lastRunId: runId,
          lastError: null,
          lastFinishedAt: new Date().toISOString()
        });
      } else {
        await this.queue.send({ ...message, afterUid: cursorEnd });
        await this.store.upsertSyncState({
          operation: FEE_DAILY_SYNC_OPERATION,
          nextCursor: cursorEnd,
          status: "running",
          lastRunId: runId,
          lastError: null
        });
      }

      return {
        operation: FEE_DAILY_SYNC_OPERATION,
        feeDate: message.feeDate,
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
        operation: FEE_DAILY_SYNC_OPERATION,
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

export async function startFeeBackfillSync(input: {
  store: XtDataStore;
  queue: FeeBackfillSyncQueue;
  now?: Date;
}): Promise<FeeBackfillSyncStartResult> {
  const now = input.now ?? new Date();
  const state = await input.store.getSyncState(FEE_BACKFILL_SYNC_OPERATION);

  if (state?.status === "running") {
    return { operation: FEE_BACKFILL_SYNC_OPERATION, started: false, reason: "already-running" };
  }

  const canStart = await canStartHeavyBackfill(input.store, FEE_BACKFILL_SYNC_OPERATION, "trade-history-backfill-sync");
  if (!canStart) {
    return { operation: FEE_BACKFILL_SYNC_OPERATION, started: false, reason: "already-running" };
  }

  await input.store.upsertSyncState({
    operation: FEE_BACKFILL_SYNC_OPERATION,
    nextCursor: state?.next_cursor ?? null,
    status: "running",
    lastRunId: state?.last_run_id ?? null,
    lastError: null,
    lastStartedAt: now.toISOString(),
    lastFinishedAt: null
  });
  await input.queue.send(parseFeeBackfillCursor(state?.next_cursor ?? null));

  return { operation: FEE_BACKFILL_SYNC_OPERATION, started: true, reason: "started" };
}

export class FeeBackfillSyncer {
  constructor(
    private readonly source: XtUserFeeSource,
    private readonly store: XtDataStore,
    private readonly queue: FeeBackfillSyncQueue,
    private readonly sourceName = "xt-mcp-http"
  ) {}

  async syncChunk(message: FeeBackfillSyncQueueMessage, dayLimit: number, fetchConcurrency: number = 2): Promise<FeeBackfillSyncChunkResult> {
    const boundedDayLimit = clampHeavyBackfillDayLimit(dayLimit);
    const boundedFetchConcurrency = clampHeavyBackfillFetchConcurrency(fetchConcurrency);
    const profile = message.uid
      ? await this.store.getFeeBackfillProfile(message.uid)
      : await this.store.getNextFeeBackfillProfile({
        afterFeeAmount: message.afterFeeAmount ?? null,
        afterUid: message.afterUid ?? null
      });
    const cursorDateStart = profile ? message.nextDate ?? getFeeBackfillStartDate(profile) : null;
    const cursorStart = profile
      ? message.uid
        ? formatFeeBackfillCursor(profile, cursorDateStart)
        : formatFeeBackfillSelectionCursor(message.afterFeeAmount ?? null, message.afterUid ?? null)
      : null;
    const runId = await this.store.createSyncRun({
      source: this.sourceName,
      operation: FEE_BACKFILL_SYNC_OPERATION,
      cursorStart
    });
    const counts = { processed: 0, inserted: 0, updated: 0, skipped: 0 };

    try {
      if (!profile || !cursorDateStart) {
        await this.finishBackfill(runId, counts);
        return this.emptyResult(runId, null, null, true, counts);
      }

      const endDate = previousGermanyDate(new Date());
      if (cursorDateStart > endDate) {
        await this.store.finishSyncRun(runId, {
          status: "success",
          cursorEnd: formatFeeBackfillCursor(profile, cursorDateStart),
          ...counts
        });
        await this.enqueueNextUserOrFinish(profile, runId, counts);
        return this.emptyResult(runId, profile.uid, cursorDateStart, false, counts);
      }

      const cursorDateEnd = minDate(addDaysToDateString(cursorDateStart, boundedDayLimit - 1), endDate);
      const existingDates = new Set(await this.store.listUserFeeSnapshotDates({
        uid: profile.uid,
        startDate: cursorDateStart,
        endDate: cursorDateEnd
      }));
      const now = new Date().toISOString();
      const targetDates: string[] = [];

      for (let currentDate = cursorDateStart; currentDate <= cursorDateEnd; currentDate = addDaysToDateString(currentDate, 1)) {
        if (existingDates.has(currentDate)) {
          counts.skipped += 1;
          continue;
        }

        targetDates.push(currentDate);
      }

      const fetchedSnapshots = await mapWithConcurrency(targetDates, boundedFetchConcurrency, async (currentDate) => {
        counts.processed += 1;
        const range = germanyDateRangeToUtcMs(currentDate);
        const fee = await this.source.fetchUserDailyFee({
          uid: profile.uid,
          feeDate: currentDate,
          sourceStartMs: range.sourceStartMs,
          sourceEndMs: range.sourceEndMs
        });

        if (!fee) {
          counts.skipped += 1;
          return null;
        }

        return {
          ...fee,
          feeDate: currentDate,
          sourceStartMs: range.sourceStartMs,
          sourceEndMs: range.sourceEndMs,
          capturedAt: now
        };
      });

      const snapshots = fetchedSnapshots.filter((snapshot): snapshot is XtUserFeeSnapshot => snapshot !== null);
      const results = await this.store.upsertUserFeeSnapshots(snapshots, runId, now);
      for (const result of results) {
        if (result.inserted) counts.inserted += 1;
        if (result.updated) counts.updated += 1;
      }

      await this.store.finishSyncRun(runId, {
        status: "success",
        cursorEnd: formatFeeBackfillCursor(profile, cursorDateEnd),
        ...counts
      });

      const nextDate = addDaysToDateString(cursorDateEnd, 1);
      if (nextDate <= endDate) {
        await this.queue.send({ uid: profile.uid, nextDate, afterFeeAmount: profile.cumulative_fee, afterUid: profile.uid });
        await this.store.upsertSyncState({
          operation: FEE_BACKFILL_SYNC_OPERATION,
          nextCursor: formatFeeBackfillCursor(profile, nextDate),
          status: "running",
          lastRunId: runId,
          lastError: null
        });
        return {
          operation: FEE_BACKFILL_SYNC_OPERATION,
          runId,
          status: "success",
          uid: profile.uid,
          cursorDateStart,
          cursorDateEnd,
          exhausted: false,
          ...counts
        };
      }

      const exhausted = await this.enqueueNextUserOrFinish(profile, runId, counts);
      return {
        operation: FEE_BACKFILL_SYNC_OPERATION,
        runId,
        status: "success",
        uid: profile.uid,
        cursorDateStart,
        cursorDateEnd,
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
        operation: FEE_BACKFILL_SYNC_OPERATION,
        nextCursor: cursorStart,
        status: "failed",
        lastRunId: runId,
        lastError: errorMessage,
        lastFinishedAt: new Date().toISOString()
      });
      throw error;
    }
  }

  private async enqueueNextUserOrFinish(profile: FeeBackfillProfile, runId: number, counts: { processed: number; inserted: number; updated: number; skipped: number }): Promise<boolean> {
    const nextProfile = await this.store.getNextFeeBackfillProfile({
      afterFeeAmount: profile.cumulative_fee,
      afterUid: profile.uid
    });
    if (!nextProfile) {
      await this.store.upsertSyncState({
        operation: FEE_BACKFILL_SYNC_OPERATION,
        nextCursor: null,
        status: "success",
        lastRunId: runId,
        lastError: null,
        lastFinishedAt: new Date().toISOString()
      });
      return true;
    }

    const startDate = getFeeBackfillStartDate(nextProfile);
    await this.queue.send({ uid: nextProfile.uid, nextDate: startDate, afterFeeAmount: profile.cumulative_fee, afterUid: profile.uid });
    await this.store.upsertSyncState({
      operation: FEE_BACKFILL_SYNC_OPERATION,
      nextCursor: formatFeeBackfillSelectionCursor(profile.cumulative_fee, profile.uid),
      status: "running",
      lastRunId: runId,
      lastError: null
    });
    return false;
  }

  private async finishBackfill(runId: number, counts: { processed: number; inserted: number; updated: number; skipped: number }): Promise<void> {
    await this.store.finishSyncRun(runId, {
      status: "success",
      cursorEnd: null,
      ...counts
    });
    await this.store.upsertSyncState({
      operation: FEE_BACKFILL_SYNC_OPERATION,
      nextCursor: null,
      status: "success",
      lastRunId: runId,
      lastError: null,
      lastFinishedAt: new Date().toISOString()
    });
  }

  private emptyResult(runId: number, uid: string | null, cursorDateStart: string | null, exhausted: boolean, counts: { processed: number; inserted: number; updated: number; skipped: number }): FeeBackfillSyncChunkResult {
    return {
      operation: FEE_BACKFILL_SYNC_OPERATION,
      runId,
      status: "success",
      uid,
      cursorDateStart,
      cursorDateEnd: cursorDateStart,
      exhausted,
      ...counts
    };
  }
}

function getFeeBackfillStartDate(profile: FeeBackfillProfile): string {
  return profile.registered_at
    ? toGermanyDate(new Date(profile.registered_at))
    : profile.first_seen_at.slice(0, 10);
}

function formatFeeBackfillCursor(profile: { uid: string; cumulative_fee_text: string }, nextDate: string | null): string {
  return nextDate ? `${profile.cumulative_fee_text}:${profile.uid}:${nextDate}` : `${profile.cumulative_fee_text}:${profile.uid}`;
}

function formatFeeBackfillSelectionCursor(afterFeeAmount: number | null, afterUid: string | null): string | null {
  if (afterFeeAmount === null && afterUid === null) return null;
  return `${afterFeeAmount ?? 0}:${afterUid ?? ""}`;
}

export function parseFeeBackfillCursor(cursor: string | null): FeeBackfillSyncQueueMessage {
  if (!cursor) return {};

  const [amountText, uid, nextDate] = cursor.split(":");
  if (!amountText || !uid) return {};

  if (nextDate) {
    return { uid, nextDate };
  }

  const afterFeeAmount = Number(amountText);
  if (!Number.isFinite(afterFeeAmount)) return {};
  return { afterFeeAmount, afterUid: uid };
}

function minDate(a: string, b: string): string {
  return a <= b ? a : b;
}
