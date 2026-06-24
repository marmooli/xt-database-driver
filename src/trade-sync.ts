import type { XtDataStore } from "./db";
import type { DailyTradeSyncChunkResult, DailyTradeSyncStartResult, TradeSyncQueueMessage } from "./types";
import type { XtUserTradeSource } from "./xt-source";

export const TRADE_DAILY_SYNC_OPERATION = "trade-daily-sync";

export interface TradeSyncQueue {
  send(message: TradeSyncQueueMessage): Promise<unknown>;
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
