import { describe, expect, it } from "vitest";
import { DailyTradeSyncer, TRADE_DAILY_SYNC_OPERATION, germanyDateRangeToUtcMs, previousGermanyDate, startDailyTradeSync, type TradeSyncQueue } from "../src/trade-sync";
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

class FakeTradeQueue implements TradeSyncQueue {
  messages: Array<{ tradeDate: string; sourceStartMs: number; sourceEndMs: number; afterUid?: string | null }> = [];

  async send(message: { tradeDate: string; sourceStartMs: number; sourceEndMs: number; afterUid?: string | null }): Promise<void> {
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
