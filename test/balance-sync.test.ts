import { describe, expect, it } from "vitest";
import { BALANCE_DAILY_SYNC_OPERATION, BalanceSyncer, DailyBalanceSyncer, startDailyBalanceSync, type BalanceSyncQueue } from "../src/balance-sync";
import { FakeStore } from "./fakes";

describe("balance sync", () => {
  it("syncs a bounded balance chunk", async () => {
    const store = new FakeStore();
    await store.upsertUser({ uid: "100", affiliateItemId: "1", role: "DIRECTOR", registeredAt: null }, 1, "now");
    await store.upsertUser({ uid: "200", affiliateItemId: "2", role: "DIRECTOR", registeredAt: null }, 1, "now");

    const source = {
      async fetchUserBalance(uid: string) {
        return { uid, role: "DIRECTOR", balance: Number(uid), balanceText: uid };
      }
    };

    const result = await new BalanceSyncer(source, store, "test-source").syncChunk(1);

    expect(result).toMatchObject({ processed: 1, inserted: 1, updated: 0 });
    expect(store.balances.size).toBe(1);
  });

  it("starts a daily balance sync once per UTC day", async () => {
    const store = new FakeStore();
    const queue = new FakeQueue();

    const first = await startDailyBalanceSync({
      store,
      queue,
      now: new Date("2026-06-23T02:00:00.000Z")
    });
    const second = await startDailyBalanceSync({
      store,
      queue,
      now: new Date("2026-06-23T03:00:00.000Z")
    });

    expect(first).toMatchObject({ started: true, reason: "started", syncDate: "2026-06-23" });
    expect(second).toMatchObject({ started: false, reason: "already-running" });
    expect(queue.messages).toEqual([{ syncDate: "2026-06-23" }]);
    expect((await store.getSyncState(BALANCE_DAILY_SYNC_OPERATION))?.status).toBe("running");
  });

  it("enqueues the next daily balance chunk when more users remain", async () => {
    const store = new FakeStore();
    await store.upsertUser({ uid: "100", affiliateItemId: "1", role: "DIRECTOR", registeredAt: null }, 1, "now");
    await store.upsertUser({ uid: "200", affiliateItemId: "2", role: "DIRECTOR", registeredAt: null }, 1, "now");
    await store.upsertUser({ uid: "300", affiliateItemId: "3", role: "DIRECTOR", registeredAt: null }, 1, "now");
    const queue = new FakeQueue();
    const source = balanceSource();

    const result = await new DailyBalanceSyncer(source, store, queue, "test-source")
      .syncChunk({ syncDate: "2026-06-23" }, 2);

    expect(result).toMatchObject({ processed: 2, exhausted: false, cursorEnd: "200" });
    expect(queue.messages).toEqual([{ syncDate: "2026-06-23", afterUid: "200" }]);
    expect((await store.getSyncState(BALANCE_DAILY_SYNC_OPERATION))?.next_cursor).toBe("200");
  });

  it("marks the daily balance sync successful when no users remain", async () => {
    const store = new FakeStore();
    await store.upsertUser({ uid: "100", affiliateItemId: "1", role: "DIRECTOR", registeredAt: null }, 1, "now");
    await store.upsertUser({ uid: "200", affiliateItemId: "2", role: "DIRECTOR", registeredAt: null }, 1, "now");
    const queue = new FakeQueue();
    const source = balanceSource();

    const result = await new DailyBalanceSyncer(source, store, queue, "test-source")
      .syncChunk({ syncDate: "2026-06-23" }, 100);

    const state = await store.getSyncState(BALANCE_DAILY_SYNC_OPERATION);
    expect(result).toMatchObject({ processed: 2, exhausted: true, cursorEnd: "200" });
    expect(queue.messages).toEqual([]);
    expect(state?.status).toBe("success");
    expect(state?.next_cursor).toBeNull();
  });
});

class FakeQueue implements BalanceSyncQueue {
  messages: Array<{ syncDate: string; afterUid?: string | null }> = [];

  async send(message: { syncDate: string; afterUid?: string | null }): Promise<void> {
    this.messages.push(message);
  }
}

function balanceSource() {
  return {
    async fetchUserBalance(uid: string) {
      return { uid, role: "DIRECTOR", balance: Number(uid), balanceText: uid };
    }
  };
}
