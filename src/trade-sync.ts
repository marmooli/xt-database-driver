import type { XtDataStore } from "./db";
import type { DailyTradeSyncChunkResult, DailyTradeSyncStartResult, TradeBackfillProfile, TradeBackfillSyncChunkResult, TradeBackfillSyncQueueMessage, TradeBackfillSyncStartResult, TradeSyncQueueMessage, UserTradeProfile, XtUserDailyTradeSnapshot } from "./types";
import { isXtRateLimitError, type XtUserTradeSource } from "./xt-source";
import { canStartHeavyBackfill, clampHeavyBackfillDayLimit, clampHeavyBackfillFetchConcurrency, mapWithConcurrency } from "./heavy-backfill";

export const TRADE_DAILY_SYNC_OPERATION = "trade-daily-sync";
export const TRADE_BACKFILL_SYNC_OPERATION = "trade-history-backfill-sync";

export interface TradeSyncQueue {
  send(message: TradeSyncQueueMessage): Promise<unknown>;
}

export interface TradeBackfillSyncQueue {
  send(message: TradeBackfillSyncQueueMessage, options?: { delaySeconds?: number }): Promise<unknown>;
}

export async function startDailyTradeSync(input: {
  store: XtDataStore;
  queue: TradeSyncQueue;
  now?: Date;
}): Promise<DailyTradeSyncStartResult> {
  const now = input.now ?? new Date();
  const runDate = toGermanyDate(now);
  const tradeDate = addDaysToDateString(runDate, -1);
  const range = germanyDateRangeToUtcMs(tradeDate);
  const state = await input.store.getSyncState(TRADE_DAILY_SYNC_OPERATION);
  const stateStartedGermanyDate = state?.last_started_at ? toGermanyDate(new Date(state.last_started_at)) : null;

  if (state?.status === "running" && stateStartedGermanyDate === runDate) {
    return { operation: TRADE_DAILY_SYNC_OPERATION, tradeDate, started: false, reason: "already-running" };
  }

  if (state?.status === "success" && stateStartedGermanyDate === runDate) {
    return { operation: TRADE_DAILY_SYNC_OPERATION, tradeDate, started: false, reason: "already-complete" };
  }

  await input.store.upsertSyncState({
    operation: TRADE_DAILY_SYNC_OPERATION,
    nextCursor: null,
    status: "running",
    lastRunId: state?.last_run_id ?? null,
    lastError: null,
    lastStartedAt: now.toISOString(),
    lastFinishedAt: null
  });
  await input.queue.send({
    tradeDate,
    sourceStartMs: range.sourceStartMs,
    sourceEndMs: range.sourceEndMs
  });

  return { operation: TRADE_DAILY_SYNC_OPERATION, tradeDate, started: true, reason: "started" };
}

export class DailyTradeSyncer {
  constructor(
    private readonly source: XtUserTradeSource,
    private readonly store: XtDataStore,
    private readonly queue: TradeSyncQueue,
    private readonly sourceName = "xt-mcp-http"
  ) {}

  async syncChunk(message: TradeSyncQueueMessage, limit: number): Promise<DailyTradeSyncChunkResult> {
    const boundedLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
    const cursorStart = message.afterUid ?? null;
    const runId = await this.store.createSyncRun({
      source: this.sourceName,
      operation: TRADE_DAILY_SYNC_OPERATION,
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
        const trade = await this.source.fetchUserDailyTrade({
          uid,
          sourceStartMs: message.sourceStartMs,
          sourceEndMs: message.sourceEndMs
        });
        const result = await this.store.upsertUserDailyTradeSnapshot({
          ...trade,
          tradeDate: message.tradeDate,
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
          operation: TRADE_DAILY_SYNC_OPERATION,
          nextCursor: null,
          status: "success",
          lastRunId: runId,
          lastError: null,
          lastFinishedAt: new Date().toISOString()
        });
      } else {
        await this.queue.send({ ...message, afterUid: cursorEnd });
        await this.store.upsertSyncState({
          operation: TRADE_DAILY_SYNC_OPERATION,
          nextCursor: cursorEnd,
          status: "running",
          lastRunId: runId,
          lastError: null
        });
      }

      return {
        operation: TRADE_DAILY_SYNC_OPERATION,
        tradeDate: message.tradeDate,
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
        operation: TRADE_DAILY_SYNC_OPERATION,
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

export async function startTradeBackfillSync(input: {
  store: XtDataStore;
  queue: TradeBackfillSyncQueue;
  now?: Date;
}): Promise<TradeBackfillSyncStartResult> {
  const now = input.now ?? new Date();
  const state = await input.store.getSyncState(TRADE_BACKFILL_SYNC_OPERATION);

  if (state?.status === "running") {
    return { operation: TRADE_BACKFILL_SYNC_OPERATION, started: false, reason: "already-running" };
  }

  const canStart = await canStartHeavyBackfill(input.store, TRADE_BACKFILL_SYNC_OPERATION, "fee-history-backfill-sync");
  if (!canStart) {
    return { operation: TRADE_BACKFILL_SYNC_OPERATION, started: false, reason: "already-running" };
  }

  await input.store.upsertSyncState({
    operation: TRADE_BACKFILL_SYNC_OPERATION,
    nextCursor: state?.next_cursor ?? null,
    status: "running",
    lastRunId: state?.last_run_id ?? null,
    lastError: null,
    lastStartedAt: now.toISOString(),
    lastFinishedAt: null
  });
  await input.queue.send(parseTradeBackfillCursor(state?.next_cursor ?? null));

  return { operation: TRADE_BACKFILL_SYNC_OPERATION, started: true, reason: "started" };
}

export class TradeBackfillSyncer {
  constructor(
    private readonly source: XtUserTradeSource,
    private readonly store: XtDataStore,
    private readonly queue: TradeBackfillSyncQueue,
    private readonly sourceName = "xt-mcp-http"
  ) {}

  async syncChunk(message: TradeBackfillSyncQueueMessage, dayLimit: number, fetchConcurrency: number = 1, continueDelaySeconds: number = 0): Promise<TradeBackfillSyncChunkResult> {
    const boundedDayLimit = clampHeavyBackfillDayLimit(dayLimit);
    const boundedFetchConcurrency = clampHeavyBackfillFetchConcurrency(fetchConcurrency);
    const boundedContinueDelaySeconds = Math.max(0, Math.trunc(continueDelaySeconds));
    const profile = message.uid
      ? await this.store.getTradeBackfillProfile(message.uid)
      : await this.store.getNextTradeBackfillProfile({
        afterTradeAmount: message.afterTradeAmount ?? null,
        afterUid: message.afterUid ?? null
      });
    const cursorDateStart = profile ? message.nextDate ?? getTradeBackfillStartDate(profile) : null;
    const cursorStart = profile
      ? message.uid
        ? formatTradeBackfillCursor(profile, cursorDateStart)
        : formatTradeBackfillSelectionCursor(message.afterTradeAmount ?? null, message.afterUid ?? null)
      : null;
    const runId = await this.store.createSyncRun({
      source: this.sourceName,
      operation: TRADE_BACKFILL_SYNC_OPERATION,
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
          cursorEnd: formatTradeBackfillCursor(profile, cursorDateStart),
          ...counts
        });
        await this.enqueueNextUserOrFinish(profile, runId, counts, boundedContinueDelaySeconds);
        return this.emptyResult(runId, profile.uid, cursorDateStart, false, counts);
      }

      const cursorDateEnd = minDate(addDaysToDateString(cursorDateStart, boundedDayLimit - 1), endDate);
      const existingDates = new Set(await this.store.listUserTradeSnapshotDates({
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
        const trade = await this.source.fetchUserDailyTrade({
          uid: profile.uid,
          sourceStartMs: range.sourceStartMs,
          sourceEndMs: range.sourceEndMs
        });

        if (!trade) {
          counts.skipped += 1;
          return null;
        }

        return {
          ...trade,
          tradeDate: currentDate,
          sourceStartMs: range.sourceStartMs,
          sourceEndMs: range.sourceEndMs,
          capturedAt: now
        };
      });

      const snapshots = fetchedSnapshots.filter((snapshot): snapshot is XtUserDailyTradeSnapshot => snapshot !== null);
      const results = await this.store.upsertUserDailyTradeSnapshots(snapshots, runId, now);
      for (const result of results) {
        if (result.inserted) counts.inserted += 1;
        if (result.updated) counts.updated += 1;
      }

      await this.store.finishSyncRun(runId, {
        status: "success",
        cursorEnd: formatTradeBackfillCursor(profile, cursorDateEnd),
        ...counts
      });

      const nextDate = addDaysToDateString(cursorDateEnd, 1);
      if (nextDate <= endDate) {
        await this.queue.send({ uid: profile.uid, nextDate }, { delaySeconds: boundedContinueDelaySeconds });
        await this.store.upsertSyncState({
          operation: TRADE_BACKFILL_SYNC_OPERATION,
          nextCursor: formatTradeBackfillCursor(profile, nextDate),
          status: "running",
          lastRunId: runId,
          lastError: null
        });
        return {
          operation: TRADE_BACKFILL_SYNC_OPERATION,
          runId,
          status: "success",
          uid: profile.uid,
          cursorDateStart,
          cursorDateEnd,
          exhausted: false,
          ...counts
        };
      }

      const exhausted = await this.enqueueNextUserOrFinish(profile, runId, counts, boundedContinueDelaySeconds);
      return {
        operation: TRADE_BACKFILL_SYNC_OPERATION,
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
      const rateLimited = isXtRateLimitError(error);
      await this.store.failSyncRun(runId, {
        cursorEnd: cursorStart,
        errorMessage,
        ...counts
      });
      await this.store.upsertSyncState({
        operation: TRADE_BACKFILL_SYNC_OPERATION,
        nextCursor: cursorStart,
        status: rateLimited ? "running" : "failed",
        lastRunId: runId,
        lastError: errorMessage,
        lastFinishedAt: rateLimited ? null : new Date().toISOString()
      });
      throw error;
    }
  }

  private async enqueueNextUserOrFinish(profile: TradeBackfillProfile, runId: number, counts: { processed: number; inserted: number; updated: number; skipped: number }, continueDelaySeconds: number): Promise<boolean> {
    const nextProfile = await this.store.getNextTradeBackfillProfile({
      afterTradeAmount: profile.cumulative_trade_amount,
      afterUid: profile.uid
    });
    if (!nextProfile) {
      await this.store.upsertSyncState({
        operation: TRADE_BACKFILL_SYNC_OPERATION,
        nextCursor: null,
        status: "success",
        lastRunId: runId,
        lastError: null,
        lastFinishedAt: new Date().toISOString()
      });
      return true;
    }

    await this.queue.send(
      { afterTradeAmount: profile.cumulative_trade_amount, afterUid: profile.uid },
      { delaySeconds: continueDelaySeconds }
    );
    await this.store.upsertSyncState({
      operation: TRADE_BACKFILL_SYNC_OPERATION,
      nextCursor: formatTradeBackfillSelectionCursor(profile.cumulative_trade_amount, profile.uid),
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
      operation: TRADE_BACKFILL_SYNC_OPERATION,
      nextCursor: null,
      status: "success",
      lastRunId: runId,
      lastError: null,
      lastFinishedAt: new Date().toISOString()
    });
  }

  private emptyResult(runId: number, uid: string | null, cursorDateStart: string | null, exhausted: boolean, counts: { processed: number; inserted: number; updated: number; skipped: number }): TradeBackfillSyncChunkResult {
    return {
      operation: TRADE_BACKFILL_SYNC_OPERATION,
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

export function previousGermanyDate(date: Date): string {
  return addDaysToDateString(toGermanyDate(date), -1);
}

export function completeGermanyDateWindow(date: Date, days: number): { startDate: string; endDate: string } {
  const boundedDays = Math.max(1, Math.trunc(days));
  const endDate = previousGermanyDate(date);
  return {
    startDate: addDaysToDateString(endDate, 1 - boundedDays),
    endDate
  };
}

function getTradeBackfillStartDate(profile: UserTradeProfile): string {
  return profile.registered_at
    ? toGermanyDate(new Date(profile.registered_at))
    : profile.first_seen_at.slice(0, 10);
}

function formatTradeBackfillCursor(profile: { uid: string; cumulative_trade_amount_text: string }, nextDate: string | null): string {
  return nextDate ? `${profile.cumulative_trade_amount_text}:${profile.uid}:${nextDate}` : `${profile.cumulative_trade_amount_text}:${profile.uid}`;
}

function formatTradeBackfillSelectionCursor(afterTradeAmount: number | null, afterUid: string | null): string | null {
  if (afterTradeAmount === null && afterUid === null) return null;
  return `${afterTradeAmount ?? 0}:${afterUid ?? ""}`;
}

export function parseTradeBackfillCursor(cursor: string | null): TradeBackfillSyncQueueMessage {
  if (!cursor) return {};

  const [amountText, uid, nextDate] = cursor.split(":");
  if (!amountText || !uid) return {};

  if (nextDate) {
    return { uid, nextDate };
  }

  const afterTradeAmount = Number(amountText);
  if (!Number.isFinite(afterTradeAmount)) return {};
  return { afterTradeAmount, afterUid: uid };
}

function minDate(a: string, b: string): string {
  return a <= b ? a : b;
}

export function germanyDateRangeToUtcMs(date: string): { sourceStartMs: number; sourceEndMs: number } {
  return {
    sourceStartMs: germanyLocalMidnightToUtcMs(date),
    sourceEndMs: germanyLocalMidnightToUtcMs(addDaysToDateString(date, 1))
  };
}

export function toGermanyDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) {
    throw new Error("Could not format Germany-local date");
  }
  return `${year}-${month}-${day}`;
}

export function addDaysToDateString(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return utc.toISOString().slice(0, 10);
}

function germanyLocalMidnightToUtcMs(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  const utcGuess = new Date(Date.UTC(year, month - 1, day));
  return utcGuess.getTime() - getTimeZoneOffsetMs("Europe/Berlin", utcGuess);
}

function getTimeZoneOffsetMs(timeZone: string, date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  const localAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second)
  );
  return localAsUtc - date.getTime();
}
