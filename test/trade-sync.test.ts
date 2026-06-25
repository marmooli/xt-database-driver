import { describe, expect, it, vi } from "vitest";
import { DailyTradeSyncer, TRADE_BACKFILL_SYNC_OPERATION, TRADE_DAILY_SYNC_OPERATION, TradeBackfillSyncer, germanyDateRangeToUtcMs, previousGermanyDate, startDailyTradeSync, startTradeBackfillSync, type TradeBackfillSyncQueue, type TradeSyncQueue } from "../src/trade-sync";
import { XtSourceError } from "../src/xt-source";
import { FakeStore } from "./fakes";

describe("daily trade sync", () => {
  it("targets the previous complete Germany-local date", () => {
    expect(previousGermanyDate(new Date("2026-06-23T02:00:00.000Z"))).toBe("2026-06-22");
  });

  it("computes Germany-local day boundaries as UTC milliseconds", () => {
    expect(germanyDateRangeToUtcMs("2026-06-22")).toEqual({
      sourceStartMs: 1782079200000,
      sourceEndMs: 1782165600000
    });
  });

  it("starts a daily trade sync once per Germany-local day", async () => {
    const store = new FakeStore();
    const queue = new FakeTradeQueue();

    const first = await startDailyTradeSync({
      store,
      queue,
      now: new Date("2026-06-23T02:00:00.000Z")
    });
    const second = await startDailyTradeSync({
      store,
      queue,
      now: new Date("2026-06-23T03:00:00.000Z")
    });

    expect(first).toMatchObject({ started: true, tradeDate: "2026-06-22" });
    expect(second).toMatchObject({ started: false, reason: "already-running" });
    expect(queue.messages).toEqual([{
      tradeDate: "2026-06-22",
      sourceStartMs: 1782079200000,
      sourceEndMs: 1782165600000
    }]);
  });

  it("stores trade snapshots and enqueues the next chunk", async () => {
    const store = new FakeStore();
    await store.upsertUser({ uid: "100", affiliateItemId: "1", role: "DIRECTOR", registeredAt: null }, 1, "now");
    await store.upsertUser({ uid: "200", affiliateItemId: "2", role: "DIRECTOR", registeredAt: null }, 1, "now");
    await store.upsertUser({ uid: "300", affiliateItemId: "3", role: "DIRECTOR", registeredAt: null }, 1, "now");
    const queue = new FakeTradeQueue();
    const source = tradeSource();

    const result = await new DailyTradeSyncer(source, store, queue, "test-source").syncChunk({
      tradeDate: "2026-06-22",
      sourceStartMs: 1782079200000,
      sourceEndMs: 1782165600000
    }, 2);

    expect(result).toMatchObject({ processed: 2, inserted: 2, exhausted: false, cursorEnd: "200" });
    expect(queue.messages).toEqual([{
      tradeDate: "2026-06-22",
      sourceStartMs: 1782079200000,
      sourceEndMs: 1782165600000,
      afterUid: "200"
    }]);
    expect(store.tradeSnapshots.get("100:2026-06-22")).toMatchObject({ trade: true, tradeAmount: 100 });
    expect((await store.getSyncState(TRADE_DAILY_SYNC_OPERATION))?.next_cursor).toBe("200");
  });

  it("marks the daily trade sync successful when no users remain", async () => {
    const store = new FakeStore();
    await store.upsertUser({ uid: "100", affiliateItemId: "1", role: "DIRECTOR", registeredAt: null }, 1, "now");
    const queue = new FakeTradeQueue();
    const source = tradeSource();

    const result = await new DailyTradeSyncer(source, store, queue, "test-source").syncChunk({
      tradeDate: "2026-06-22",
      sourceStartMs: 1782079200000,
      sourceEndMs: 1782165600000
    }, 100);

    expect(result).toMatchObject({ processed: 1, exhausted: true });
    expect(queue.messages).toEqual([]);
    expect((await store.getSyncState(TRADE_DAILY_SYNC_OPERATION))?.status).toBe("success");
  });
});

describe("trade history backfill sync", () => {
  it("starts trade backfill once while running", async () => {
    const store = new FakeStore();
    const queue = new FakeTradeBackfillQueue();

    const first = await startTradeBackfillSync({ store, queue, now: new Date("2026-06-24T02:00:00.000Z") });
    const second = await startTradeBackfillSync({ store, queue, now: new Date("2026-06-24T02:01:00.000Z") });

    expect(first).toMatchObject({ started: true, operation: TRADE_BACKFILL_SYNC_OPERATION });
    expect(second).toMatchObject({ started: false, reason: "already-running" });
    expect(queue.messages).toEqual([{}]);
  });

  it("resumes a failed trade backfill from its stored cursor", async () => {
    const store = new FakeStore();
    const queue = new FakeTradeBackfillQueue();
    await store.upsertSyncState({
      operation: TRADE_BACKFILL_SYNC_OPERATION,
      nextCursor: "12914581.8532081:6117973230304",
      status: "failed",
      lastRunId: 1,
      lastError: "XT trade proxy source returned HTTP 429",
      lastStartedAt: new Date("2026-06-24T02:00:00.000Z").toISOString(),
      lastFinishedAt: new Date("2026-06-24T02:05:00.000Z").toISOString()
    });

    const result = await startTradeBackfillSync({ store, queue, now: new Date("2026-06-24T02:10:00.000Z") });

    expect(result).toMatchObject({ started: true, reason: "started" });
    expect(queue.messages).toEqual([{ afterTradeAmount: 12914581.8532081, afterUid: "6117973230304" }]);
    expect((await store.getSyncState(TRADE_BACKFILL_SYNC_OPERATION))?.next_cursor).toBe("12914581.8532081:6117973230304");
  });

  it("prioritizes higher cumulative trade volume, breaks ties by uid, and places zero-volume users last", async () => {
    const store = new FakeStore();
    await store.upsertUser({ uid: "100", affiliateItemId: "1", role: "DIRECTOR", registeredAt: Date.UTC(2026, 5, 23) }, 1, "now");
    await store.upsertUser({ uid: "200", affiliateItemId: "2", role: "DIRECTOR", registeredAt: Date.UTC(2026, 5, 23) }, 1, "now");
    await store.upsertUser({ uid: "300", affiliateItemId: "3", role: "DIRECTOR", registeredAt: Date.UTC(2026, 5, 23) }, 1, "now");
    await store.upsertUserDailyTradeSnapshot({
      uid: "200",
      role: "DIRECTOR",
      trade: true,
      tradeAmount: 10,
      tradeAmountText: "10",
      tradeDate: "2026-06-20",
      sourceStartMs: 0,
      sourceEndMs: 0,
      capturedAt: "now"
    }, 1, "now");
    await store.upsertUserDailyTradeSnapshot({
      uid: "200",
      role: "DIRECTOR",
      trade: true,
      tradeAmount: 10,
      tradeAmountText: "10",
      tradeDate: "2026-06-21",
      sourceStartMs: 0,
      sourceEndMs: 0,
      capturedAt: "now"
    }, 1, "now");
    await store.upsertUserDailyTradeSnapshot({
      uid: "300",
      role: "DIRECTOR",
      trade: true,
      tradeAmount: 20,
      tradeAmountText: "20",
      tradeDate: "2026-06-20",
      sourceStartMs: 0,
      sourceEndMs: 0,
      capturedAt: "now"
    }, 1, "now");
    const queue = new FakeTradeBackfillQueue();
    const syncer = new TradeBackfillSyncer(tradeSource(), store, queue, "test-source");

    const first = await syncer.syncChunk({}, 100);
    const second = await syncer.syncChunk(queue.messages[0], 100);
    const third = await syncer.syncChunk(queue.messages[1], 100);

    expect(first.uid).toBe("200");
    expect(second.uid).toBe("300");
    expect(third.uid).toBe("100");
    expect(queue.messages).toEqual([
      { afterTradeAmount: 20, afterUid: "200" },
      { afterTradeAmount: 20, afterUid: "300" }
    ]);
  });

  it("skips users already complete through the current target date when selecting the next candidate", async () => {
    const store = new FakeStore();
    await store.upsertUser({ uid: "100", affiliateItemId: "1", role: "DIRECTOR", registeredAt: Date.UTC(2026, 5, 21) }, 1, "now");
    await store.upsertUser({ uid: "200", affiliateItemId: "2", role: "DIRECTOR", registeredAt: Date.UTC(2026, 5, 21) }, 1, "now");
    await store.upsertUser({ uid: "300", affiliateItemId: "3", role: "DIRECTOR", registeredAt: Date.UTC(2026, 5, 21) }, 1, "now");
    await store.upsertUserDailyTradeSnapshot({
      uid: "200",
      role: "DIRECTOR",
      trade: true,
      tradeAmount: 10,
      tradeAmountText: "10",
      tradeDate: "2026-06-20",
      sourceStartMs: 0,
      sourceEndMs: 0,
      capturedAt: "now"
    }, 1, "now");
    await store.upsertUserDailyTradeSnapshot({
      uid: "200",
      role: "DIRECTOR",
      trade: true,
      tradeAmount: 10,
      tradeAmountText: "10",
      tradeDate: "2026-06-21",
      sourceStartMs: 0,
      sourceEndMs: 0,
      capturedAt: "now"
    }, 1, "now");
    await store.upsertUserDailyTradeSnapshot({
      uid: "300",
      role: "DIRECTOR",
      trade: true,
      tradeAmount: 30,
      tradeAmountText: "30",
      tradeDate: "2026-06-20",
      sourceStartMs: 0,
      sourceEndMs: 0,
      capturedAt: "now"
    }, 1, "now");
    await store.updateTradeBackfillCompletionMarker({
      uid: "300",
      completedThroughDate: "2026-06-21",
      now: "2026-06-21T23:00:00.000Z"
    });
    const queue = new FakeTradeBackfillQueue();
    const syncer = new TradeBackfillSyncer(tradeSource(), store, queue, "test-source");

    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-06-22T02:00:00.000Z"));
      const result = await syncer.syncChunk({}, 100);

      expect(result.uid).toBe("200");
      expect(queue.messages).toEqual([{ afterTradeAmount: 20, afterUid: "200" }]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("writes a completion marker and resumes from the next day when the target advances", async () => {
    const store = new FakeStore();
    await store.upsertUser({ uid: "100", affiliateItemId: "1", role: "DIRECTOR", registeredAt: Date.UTC(2026, 5, 21) }, 1, "now");
    const queue = new FakeTradeBackfillQueue();
    const syncer = new TradeBackfillSyncer(tradeSource(), store, queue, "test-source");

    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-06-25T02:00:00.000Z"));
      const first = await syncer.syncChunk({}, 100);
      expect(first).toMatchObject({ uid: "100", exhausted: true });
      expect(store.users.get("100")?.tradeBackfillCompletedThroughDate).toBe("2026-06-24");

      vi.setSystemTime(new Date("2026-06-26T02:00:00.000Z"));
      const second = await syncer.syncChunk({}, 100);
      expect(second).toMatchObject({ uid: "100", processed: 1, skipped: 0 });
      expect(store.users.get("100")?.tradeBackfillCompletedThroughDate).toBe("2026-06-25");
    } finally {
      vi.useRealTimers();
    }
  });

  it("backfills missing daily trade snapshots and continues the same user", async () => {
    const store = new FakeStore();
    await store.upsertUser({ uid: "100", affiliateItemId: "1", role: "DIRECTOR", registeredAt: Date.UTC(2026, 5, 21) }, 1, "now");
    await store.upsertUserDailyTradeSnapshot({
      uid: "100",
      role: "DIRECTOR",
      trade: true,
      tradeAmount: 0,
      tradeAmountText: "0",
      tradeDate: "2026-06-21",
      sourceStartMs: 0,
      sourceEndMs: 0,
      capturedAt: "now"
    }, 1, "now");
    const queue = new FakeTradeBackfillQueue();

    const result = await new TradeBackfillSyncer(tradeSource(), store, queue, "test-source")
      .syncChunk({ uid: "100", nextDate: "2026-06-21" }, 2);

    expect(result).toMatchObject({ uid: "100", processed: 1, skipped: 1, inserted: 1, exhausted: false });
    expect(store.tradeSnapshots.get("100:2026-06-22")).toMatchObject({ tradeAmount: 100 });
    expect(queue.messages).toEqual([{ uid: "100", nextDate: "2026-06-23" }]);
  });

  it("keeps backfill running and preserves the cursor when the source rate-limits", async () => {
    const store = new FakeStore();
    await store.upsertUser({ uid: "100", affiliateItemId: "1", role: "DIRECTOR", registeredAt: Date.UTC(2026, 5, 21) }, 1, "now");
    const queue = new FakeTradeBackfillQueue();

    await expect(new TradeBackfillSyncer(rateLimitedTradeSource(), store, queue, "test-source")
      .syncChunk({ uid: "100", nextDate: "2026-06-21" }, 2))
      .rejects.toThrow("HTTP 429");

    const state = await store.getSyncState(TRADE_BACKFILL_SYNC_OPERATION);
    expect(state).toMatchObject({
      status: "running",
      next_cursor: "0:100:2026-06-21",
      last_error: "XT trade proxy source returned HTTP 429"
    });
  });
});

class FakeTradeQueue implements TradeSyncQueue {
  messages: Array<{ tradeDate: string; sourceStartMs: number; sourceEndMs: number; afterUid?: string | null }> = [];

  async send(message: { tradeDate: string; sourceStartMs: number; sourceEndMs: number; afterUid?: string | null }): Promise<void> {
    this.messages.push(message);
  }
}

class FakeTradeBackfillQueue implements TradeBackfillSyncQueue {
  messages: Array<{ uid?: string | null; nextDate?: string | null; afterTradeAmount?: number | null; afterUid?: string | null }> = [];

  async send(message: { uid?: string | null; nextDate?: string | null; afterTradeAmount?: number | null; afterUid?: string | null }): Promise<void> {
    this.messages.push(message);
  }
}

function tradeSource() {
  return {
    async fetchUserDailyTrade(input: { uid: string }) {
      return {
        uid: input.uid,
        role: "DIRECTOR",
        trade: true,
        tradeAmount: Number(input.uid),
        tradeAmountText: input.uid
      };
    }
  };
}

function rateLimitedTradeSource() {
  return {
    async fetchUserDailyTrade() {
      throw new XtSourceError("XT trade proxy source returned HTTP 429", undefined, 429);
    }
  };
}
