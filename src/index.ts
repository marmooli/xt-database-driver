import { DailyBalanceSyncer } from "./balance-sync";
import { D1XtDataStore } from "./db";
import { handleRequest } from "./http";
import { runScheduledUidSync, startScheduledDailyBalanceSync, startScheduledDailyTradeSync } from "./scheduled";
import { createBalanceSource, createTradeSource, getSourceName } from "./source-factory";
import { DailyTradeSyncer } from "./trade-sync";
import type { BalanceSyncQueueMessage, TradeSyncQueueMessage } from "./types";

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env);
  },

  scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): void {
    ctx.waitUntil(runScheduledUidSync(env));
    ctx.waitUntil(startScheduledDailyBalanceSync(env));
    ctx.waitUntil(startScheduledDailyTradeSync(env));
  },

  async queue(batch: MessageBatch<BalanceSyncQueueMessage | TradeSyncQueueMessage>, env: Env, _ctx: ExecutionContext): Promise<void> {
    if (batch.queue === "xt-trade-sync") {
      const syncer = new DailyTradeSyncer(
        createTradeSource(env),
        new D1XtDataStore(env.XT_DB),
        env.TRADE_SYNC_QUEUE,
        getSourceName(env)
      );
      const limit = parsePositiveInteger(env.TRADE_SYNC_CHUNK_LIMIT, 10);
      for (const message of batch.messages) {
        await syncer.syncChunk(message.body as TradeSyncQueueMessage, limit);
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
