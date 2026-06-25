import { describe, expect, it } from "vitest";
import { DailyFeeSyncer, FeeBackfillSyncer, FEE_DAILY_SYNC_OPERATION, startDailyFeeSync, startFeeBackfillSync, type FeeBackfillSyncQueue, type FeeSyncQueue } from "../src/fee-sync";
import { germanyDateRangeToUtcMs } from "../src/trade-sync";
import { parseUserCommissionsResponse } from "../src/xt-source";
import { FakeStore } from "./fakes";

describe("fee source parsing", () => {
  it("aggregates commission fees for a single Germany-local day", () => {
    const payload = {
      result: [
        { commissionDate: "2026-06-24", fee: 1.5 },
        { commissionDate: "2026-06-24", fee: "2.5" },
        { commissionDate: "2026-06-23", fee: 9 }
      ]
    };

    expect(parseUserCommissionsResponse(payload, "6636211405916", "2026-06-24")).toEqual({
      uid: "6636211405916",
      fee: 4,
      feeText: "4"
    });
  });
});

describe("daily fee sync", () => {
  it("starts a daily fee sync once per Germany-local day", async () => {
    const store = new FakeStore();
    const queue = new FakeFeeQueue();

    const first = await startDailyFeeSync({
      store,
      queue,
      now: new Date("2026-06-24T02:00:00.000Z")
    });
    const second = await startDailyFeeSync({
      store,
      queue,
      now: new Date("2026-06-24T03:00:00.000Z")
    });

    expect(first).toMatchObject({ started: true, feeDate: "2026-06-23" });
    expect(second).toMatchObject({ started: false, reason: "already-running" });
    expect(queue.messages).toEqual([{
      feeDate: "2026-06-23",
      sourceStartMs: germanyDateRangeToUtcMs("2026-06-23").sourceStartMs,
      sourceEndMs: germanyDateRangeToUtcMs("2026-06-23").sourceEndMs
    }]);
  });

  it("stores fee snapshots and enqueues the next chunk", async () => {
    const store = new FakeStore();
    await store.upsertUser({ uid: "100", affiliateItemId: "1", role: "DIRECTOR", registeredAt: null }, 1, "now");
    await store.upsertUser({ uid: "200", affiliateItemId: "2", role: "DIRECTOR", registeredAt: null }, 1, "now");
    await store.upsertUser({ uid: "300", affiliateItemId: "3", role: "DIRECTOR", registeredAt: null }, 1, "now");
    const queue = new FakeFeeQueue();
    const source = feeSource();

    const result = await new DailyFeeSyncer(source, store, queue, "test-source").syncChunk({
      feeDate: "2026-06-23",
      sourceStartMs: germanyDateRangeToUtcMs("2026-06-23").sourceStartMs,
      sourceEndMs: germanyDateRangeToUtcMs("2026-06-23").sourceEndMs
    }, 2);

    expect(result).toMatchObject({ processed: 2, inserted: 2, exhausted: false, cursorEnd: "200" });
    expect(queue.messages).toEqual([{
      feeDate: "2026-06-23",
      sourceStartMs: germanyDateRangeToUtcMs("2026-06-23").sourceStartMs,
      sourceEndMs: germanyDateRangeToUtcMs("2026-06-23").sourceEndMs,
      afterUid: "200"
    }]);
    expect(store.feeSnapshots.get("100:2026-06-23")).toMatchObject({ fee: 100, feeText: "100" });
    expect((await store.getSyncState(FEE_DAILY_SYNC_OPERATION))?.next_cursor).toBe("200");
  });
});

describe("fee history backfill", () => {
  it("starts fee backfill once while running", async () => {
    const store = new FakeStore();
    const queue = new FakeFeeBackfillQueue();

    const first = await startFeeBackfillSync({ store, queue, now: new Date("2026-06-24T02:00:00.000Z") });
    const second = await startFeeBackfillSync({ store, queue, now: new Date("2026-06-24T02:01:00.000Z") });

    expect(first).toMatchObject({ started: true, operation: "fee-history-backfill-sync" });
    expect(second).toMatchObject({ started: false, reason: "already-running" });
    expect(queue.messages).toEqual([{}]);
  });

  it("backfills missing daily fee snapshots and continues the same user", async () => {
    const store = new FakeStore();
    await store.upsertUser({ uid: "100", affiliateItemId: "1", role: "DIRECTOR", registeredAt: Date.UTC(2026, 5, 21) }, 1, "now");
    await store.upsertUserFeeSnapshot({
      uid: "100",
      feeDate: "2026-06-21",
      fee: 0,
      feeText: "0",
      sourceStartMs: 0,
      sourceEndMs: 0,
      capturedAt: "now"
    }, 1, "now");
    const queue = new FakeFeeBackfillQueue();

    const result = await new FeeBackfillSyncer(feeSource(), store, queue, "test-source")
      .syncChunk({ uid: "100", nextDate: "2026-06-21" }, 2);

    expect(result).toMatchObject({ uid: "100", processed: 1, skipped: 1, inserted: 1, exhausted: false });
    expect(store.feeSnapshots.get("100:2026-06-22")).toMatchObject({ fee: 100 });
    expect(queue.messages).toEqual([{ uid: "100", nextDate: "2026-06-23", afterUid: "100" }]);
  });
});

class FakeFeeQueue implements FeeSyncQueue {
  messages: Array<{ feeDate: string; sourceStartMs: number; sourceEndMs: number; afterUid?: string | null }> = [];

  async send(message: { feeDate: string; sourceStartMs: number; sourceEndMs: number; afterUid?: string | null }): Promise<void> {
    this.messages.push(message);
  }
}

class FakeFeeBackfillQueue implements FeeBackfillSyncQueue {
  messages: Array<{ uid?: string | null; nextDate?: string | null; afterUid?: string | null }> = [];

  async send(message: { uid?: string | null; nextDate?: string | null; afterUid?: string | null }): Promise<void> {
    this.messages.push(message);
  }
}

function feeSource() {
  return {
    async fetchUserDailyFee(input: { uid: string; feeDate: string }) {
      return {
        uid: input.uid,
        fee: Number(input.uid),
        feeText: input.uid
      };
    }
  };
}
