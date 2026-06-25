import { DailyBalanceSyncer } from "./balance-sync";
import { D1XtDataStore } from "./db";
import { DailyFeeSyncer, FeeBackfillSyncer } from "./fee-sync";
import { handleRequest } from "./http";
import { resolveHeavyBackfillContinueDelaySeconds, resolveHeavyBackfillDayLimit, resolveHeavyBackfillFetchConcurrency, resolveHeavyBackfillRateLimitRetryDelaySeconds } from "./heavy-backfill";
import { runScheduledUidSync, startScheduledDailyBalanceSync, startScheduledDailyFeeSync, startScheduledDailyTradeSync, startScheduledUserInfoBackfillSync } from "./scheduled";
import { createBalanceSource, createFeeSource, createTradeSource, createUserInfoSource, getSourceName, getTradeSourceName } from "./source-factory";
import { DailyTradeSyncer, TradeBackfillSyncer } from "./trade-sync";
import type { BalanceSyncQueueMessage, FeeBackfillSyncQueueMessage, FeeSyncQueueMessage, TradeBackfillSyncQueueMessage, TradeSyncQueueMessage, UserInfoSyncQueueMessage } from "./types";
import { UserInfoBackfillSyncer } from "./user-info-sync";
import { XtSourceError, isXtRateLimitError } from "./xt-source";

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env);
  },

  scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): void {
    ctx.waitUntil(runScheduledUidSync(env));
    ctx.waitUntil(startScheduledDailyBalanceSync(env));
    ctx.waitUntil(startScheduledDailyFeeSync(env));
    ctx.waitUntil(startScheduledDailyTradeSync(env));
    ctx.waitUntil(startScheduledUserInfoBackfillSync(env));
  },

  async queue(batch: MessageBatch<BalanceSyncQueueMessage | FeeSyncQueueMessage | FeeBackfillSyncQueueMessage | TradeSyncQueueMessage | TradeBackfillSyncQueueMessage | UserInfoSyncQueueMessage>, env: Env, _ctx: ExecutionContext): Promise<void> {
    if (batch.queue === "xt-trade-sync") {
      const syncer = new DailyTradeSyncer(
        createTradeSource(env),
        new D1XtDataStore(env.XT_DB),
        env.TRADE_SYNC_QUEUE,
        getTradeSourceName()
      );
      const limit = parsePositiveInteger(env.TRADE_SYNC_CHUNK_LIMIT, 10);
      for (const message of batch.messages) {
        await syncer.syncChunk(message.body as TradeSyncQueueMessage, limit);
      }
      return;
    }

    if (batch.queue === "xt-fee-sync") {
      const syncer = new DailyFeeSyncer(
        createFeeSource(env),
        new D1XtDataStore(env.XT_DB),
        env.FEE_SYNC_QUEUE,
        getSourceName(env)
      );
      const limit = parsePositiveInteger(env.FEE_SYNC_CHUNK_LIMIT, 100);
      for (const message of batch.messages) {
        await syncer.syncChunk(message.body as FeeSyncQueueMessage, limit);
      }
      return;
    }

    if (batch.queue === "xt-trade-backfill-sync") {
      const syncer = new TradeBackfillSyncer(
        createTradeSource(env),
        new D1XtDataStore(env.XT_DB),
        env.TRADE_BACKFILL_SYNC_QUEUE,
        getTradeSourceName()
      );
      const limit = resolveHeavyBackfillDayLimit(env.TRADE_BACKFILL_SYNC_DAY_LIMIT);
      const fetchConcurrency = resolveHeavyBackfillFetchConcurrency(env.TRADE_BACKFILL_SYNC_FETCH_CONCURRENCY);
      const continueDelaySeconds = resolveHeavyBackfillContinueDelaySeconds(env.TRADE_BACKFILL_SYNC_CONTINUE_DELAY_SECONDS);
      for (const message of batch.messages) {
        try {
          await syncer.syncChunk(message.body as TradeBackfillSyncQueueMessage, limit, fetchConcurrency, continueDelaySeconds);
        } catch (error) {
          if (!isXtRateLimitError(error)) {
            throw error;
          }

          const retryDelaySeconds = resolveHeavyBackfillRateLimitRetryDelaySeconds(
            env.TRADE_BACKFILL_SYNC_RATE_LIMIT_RETRY_DELAY_SECONDS,
            error instanceof XtSourceError ? error.retryAfterSeconds : undefined
          );
          await env.TRADE_BACKFILL_SYNC_QUEUE.send(message.body as TradeBackfillSyncQueueMessage, {
            delaySeconds: retryDelaySeconds
          });
        }
      }
      return;
    }

    if (batch.queue === "xt-fee-backfill-sync") {
      const syncer = new FeeBackfillSyncer(
        createFeeSource(env),
        new D1XtDataStore(env.XT_DB),
        env.FEE_BACKFILL_SYNC_QUEUE,
        getSourceName(env)
      );
      const limit = resolveHeavyBackfillDayLimit(env.FEE_BACKFILL_SYNC_DAY_LIMIT);
      const fetchConcurrency = resolveHeavyBackfillFetchConcurrency(env.FEE_BACKFILL_SYNC_FETCH_CONCURRENCY);
      for (const message of batch.messages) {
        await syncer.syncChunk(message.body as FeeBackfillSyncQueueMessage, limit, fetchConcurrency);
      }
      return;
    }

    if (batch.queue === "xt-user-info-sync") {
      const syncer = new UserInfoBackfillSyncer(
        createUserInfoSource(env),
        new D1XtDataStore(env.XT_DB),
        env.USER_INFO_SYNC_QUEUE,
        getSourceName(env)
      );
      const limit = parsePositiveInteger(env.USER_INFO_SYNC_CHUNK_LIMIT, 100);
      for (const message of batch.messages) {
        await syncer.syncChunk(message.body as UserInfoSyncQueueMessage, limit);
      }
      return;
    }

    const syncer = new DailyBalanceSyncer(
      createBalanceSource(env),
      new D1XtDataStore(env.XT_DB),
      env.BALANCE_SYNC_QUEUE,
      getSourceName(env)
    );
    const limit = parsePositiveInteger(env.BALANCE_SYNC_CHUNK_LIMIT, 100);
    for (const message of batch.messages) {
      await syncer.syncChunk(message.body as BalanceSyncQueueMessage, limit);
    }
  }
};

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
