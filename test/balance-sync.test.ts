import { describe, expect, it } from "vitest";
import { BalanceSyncer } from "../src/balance-sync";
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
});
