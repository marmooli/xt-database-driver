import { startDailyBalanceSync } from "./balance-sync";
import { D1XtDataStore, type XtDataStore } from "./db";
import { UidImporter } from "./importer";
import { createXtSource, getSourceName } from "./source-factory";
import { startDailyTradeSync } from "./trade-sync";
import type { DailyBalanceSyncStartResult, DailyTradeSyncStartResult, ScheduledSyncResult } from "./types";
import type { XtAffiliateUserSource } from "./xt-source";

export const UID_SCHEDULED_SYNC_OPERATION = "uid-scheduled-sync";

export async function runScheduledUidSync(env: Env): Promise<ScheduledSyncResult> {
  return runScheduledUidSyncWithDependencies({
    store: new D1XtDataStore(env.XT_DB),
    source: createXtSource(env),
    sourceName: getSourceName(env),
    maxPages: parsePositiveInteger(env.UID_SYNC_MAX_PAGES, 5),
    limit: parsePositiveInteger(env.UID_SYNC_LIMIT, 100)
  });
}

export async function startScheduledDailyBalanceSync(env: Env): Promise<DailyBalanceSyncStartResult> {
  return startDailyBalanceSync({
    store: new D1XtDataStore(env.XT_DB),
    queue: env.BALANCE_SYNC_QUEUE
  });
}

export async function startScheduledDailyTradeSync(env: Env): Promise<DailyTradeSyncStartResult> {
  return startDailyTradeSync({
    store: new D1XtDataStore(env.XT_DB),
    queue: env.TRADE_SYNC_QUEUE
  });
}

export async function runScheduledUidSyncWithDependencies(input: {
  store: XtDataStore;
  source: XtAffiliateUserSource;
  sourceName: string;
  maxPages: number;
  limit: number;
}): Promise<ScheduledSyncResult> {
  const state = await input.store.getSyncState(UID_SCHEDULED_SYNC_OPERATION);
  const cursorStart = state?.next_cursor ?? null;
  const startedAt = new Date().toISOString();

  await input.store.upsertSyncState({
    operation: UID_SCHEDULED_SYNC_OPERATION,
    nextCursor: cursorStart,
    status: "running",
    lastRunId: state?.last_run_id ?? null,
    lastError: null,
    lastStartedAt: startedAt,
    lastFinishedAt: null
  });

  try {
    const importer = new UidImporter(input.source, input.store, input.sourceName);
    const importResult = await importer.importAll({
      fromId: cursorStart ?? undefined,
      maxPages: input.maxPages,
      limit: input.limit
    });
    const capacity = input.maxPages * input.limit;
    const exhausted = importResult.processed < capacity || importResult.cursorEnd === cursorStart;
    const nextCursor = exhausted ? null : importResult.cursorEnd;

    await input.store.upsertSyncState({
      operation: UID_SCHEDULED_SYNC_OPERATION,
      nextCursor,
      status: "success",
      lastRunId: importResult.runId,
      lastError: null,
      lastStartedAt: startedAt,
      lastFinishedAt: new Date().toISOString()
    });

    return {
      operation: UID_SCHEDULED_SYNC_OPERATION,
      exhausted,
      nextCursor,
      importResult
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await input.store.upsertSyncState({
      operation: UID_SCHEDULED_SYNC_OPERATION,
      nextCursor: cursorStart,
      status: "failed",
      lastRunId: state?.last_run_id ?? null,
      lastError: errorMessage,
      lastStartedAt: startedAt,
      lastFinishedAt: new Date().toISOString()
    });
    throw error;
  }
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
