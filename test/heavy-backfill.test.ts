import { describe, expect, it } from "vitest";
import { FEE_BACKFILL_SYNC_OPERATION, FeeBackfillSyncer, startDailyFeeSync, startFeeBackfillSync } from "../src/fee-sync";
import { clampHeavyBackfillDayLimit, clampHeavyBackfillFetchConcurrency } from "../src/heavy-backfill";
import { TRADE_BACKFILL_SYNC_OPERATION, TradeBackfillSyncer, startDailyTradeSync, startTradeBackfillSync } from "../src/trade-sync";
import { FakeStore } from "./fakes";

describe("heavy backfill guardrails", () => {
  it("does not start a second heavy backfill while one is already running", async () => {
    const store = new FakeStore();
    const feeQueue = new FakeQueue();
    const tradeQueue = new FakeQueue();

    await store.upsertSyncState({
      operation: TRADE_BACKFILL_SYNC_OPERATION,
      nextCursor: "100:2026-06-20",
      status: "running",
      lastRunId: 1,
      lastError: null,
      lastStartedAt: new Date("2026-06-24T02:00:00.000Z").toISOString(),
      lastFinishedAt: null
    });

    const feeStart = await startFeeBackfillSync({ store, queue: feeQueue, now: new Date("2026-06-24T02:05:00.000Z") });
    expect(feeStart).toMatchObject({ started: false, reason: "already-running" });
    expect(feeQueue.messages).toEqual([]);

    await store.resetSyncState(TRADE_BACKFILL_SYNC_OPERATION);
    await store.upsertSyncState({
      operation: FEE_BACKFILL_SYNC_OPERATION,
      nextCursor: "100:2026-06-20",
      status: "running",
      lastRunId: 2,
      lastError: null,
      lastStartedAt: new Date("2026-06-24T02:10:00.000Z").toISOString(),
      lastFinishedAt: null
    });

    const tradeStart = await startTradeBackfillSync({ store, queue: tradeQueue, now: new Date("2026-06-24T02:15:00.000Z") });
    expect(tradeStart).toMatchObject({ started: false, reason: "already-running" });
    expect(tradeQueue.messages).toEqual([]);
  });

  it("still starts daily syncs while a heavy backfill is running", async () => {
    const store = new FakeStore();
    const feeQueue = new FakeQueue();
    const tradeQueue = new FakeQueue();

    await store.upsertSyncState({
      operation: TRADE_BACKFILL_SYNC_OPERATION,
      nextCursor: "100:2026-06-20",
      status: "running",
      lastRunId: 1,
      lastError: null,
      lastStartedAt: new Date("2026-06-24T02:00:00.000Z").toISOString(),
      lastFinishedAt: null
    });

    const feeDaily = await startDailyFeeSync({
      store,
      queue: feeQueue,
      now: new Date("2026-06-24T02:05:00.000Z")
    });
    expect(feeDaily.started).toBe(true);
    expect(feeQueue.messages).toHaveLength(1);

    await store.resetSyncState(TRADE_BACKFILL_SYNC_OPERATION);
    await store.upsertSyncState({
      operation: FEE_BACKFILL_SYNC_OPERATION,
      nextCursor: "100:2026-06-20",
      status: "running",
      lastRunId: 2,
      lastError: null,
      lastStartedAt: new Date("2026-06-24T02:10:00.000Z").toISOString(),
      lastFinishedAt: null
    });

    const tradeDaily = await startDailyTradeSync({
      store,
      queue: tradeQueue,
      now: new Date("2026-06-24T02:15:00.000Z")
    });
    expect(tradeDaily.started).toBe(true);
    expect(tradeQueue.messages).toHaveLength(1);
  });

  it("clamps heavy backfill limits and fetch concurrency", () => {
    expect(clampHeavyBackfillDayLimit(100)).toBe(25);
    expect(clampHeavyBackfillDayLimit(20)).toBe(20);
    expect(clampHeavyBackfillFetchConcurrency(100)).toBe(4);
    expect(clampHeavyBackfillFetchConcurrency(2)).toBe(2);
  });
});

describe("heavy backfill throughput", () => {
  it("batches trade backfill writes and keeps fetch concurrency bounded", async () => {
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
    const initialBatchCount = store.tradeSnapshotBatchSizes.length;

    const { source, getMaxInFlight } = createDelayedTradeSource();
    const queue = new FakeTradeBackfillQueue();

    const result = await new TradeBackfillSyncer(source, store, queue, "test-source")
      .syncChunk({ uid: "100", nextDate: "2026-06-21" }, 25, 2);

    expect(result.processed).toBeGreaterThan(0);
    expect(getMaxInFlight()).toBeLessThanOrEqual(2);
    expect(store.tradeSnapshotBatchSizes.length).toBe(initialBatchCount + 1);
    expect(store.tradeSnapshotBatchSizes.at(-1)).toBeGreaterThan(0);
  });

  it("batches fee backfill writes and keeps fetch concurrency bounded", async () => {
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
    const initialBatchCount = store.feeSnapshotBatchSizes.length;

    const { source, getMaxInFlight } = createDelayedFeeSource();
    const queue = new FakeFeeBackfillQueue();

    const result = await new FeeBackfillSyncer(source, store, queue, "test-source")
      .syncChunk({ uid: "100", nextDate: "2026-06-21" }, 25, 2);

    expect(result.processed).toBeGreaterThan(0);
    expect(getMaxInFlight()).toBeLessThanOrEqual(2);
    expect(store.feeSnapshotBatchSizes.length).toBe(initialBatchCount + 1);
    expect(store.feeSnapshotBatchSizes.at(-1)).toBeGreaterThan(0);
  });
});

class FakeQueue {
  messages: unknown[] = [];

  async send(message: unknown): Promise<void> {
    this.messages.push(message);
  }
}

class FakeTradeBackfillQueue extends FakeQueue {}

class FakeFeeBackfillQueue extends FakeQueue {}

function createDelayedTradeSource() {
  let inFlight = 0;
  let maxInFlight = 0;

  return {
    source: {
      async fetchUserDailyTrade(input: { uid: string }) {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await delay(5);
        inFlight -= 1;
        return {
          uid: input.uid,
          role: "DIRECTOR",
          trade: true,
          tradeAmount: Number(input.uid),
          tradeAmountText: input.uid
        };
      }
    },
    getMaxInFlight: () => maxInFlight
  };
}

function createDelayedFeeSource() {
  let inFlight = 0;
  let maxInFlight = 0;

  return {
    source: {
      async fetchUserDailyFee(input: { uid: string; feeDate: string }) {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await delay(5);
        inFlight -= 1;
        return {
          uid: input.uid,
          fee: Number(input.uid),
          feeText: input.uid
        };
      }
    },
    getMaxInFlight: () => maxInFlight
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
