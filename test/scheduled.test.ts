import { describe, expect, it } from "vitest";
import { runScheduledUidSyncWithDependencies, UID_SCHEDULED_SYNC_OPERATION } from "../src/scheduled";
import { FakeSource, FakeStore } from "./fakes";

describe("scheduled UID sync", () => {
  it("stores the next cursor when a scheduled chunk reaches capacity", async () => {
    const store = new FakeStore();
    const source = new FakeSource([
      { hasNext: true, items: [{ id: 10, userId: 1000 }] },
      { hasNext: true, items: [{ id: 20, userId: 2000 }] }
    ]);

    const result = await runScheduledUidSyncWithDependencies({
      store,
      source,
      sourceName: "test-source",
      maxPages: 2,
      limit: 1
    });

    const state = await store.getSyncState(UID_SCHEDULED_SYNC_OPERATION);
    expect(result.exhausted).toBe(false);
    expect(state?.status).toBe("success");
    expect(state?.next_cursor).toBe("20");
    expect(state?.last_run_id).toBe(result.importResult.runId);
  });

  it("clears the next cursor when a scheduled chunk exhausts the source", async () => {
    const store = new FakeStore();
    const source = new FakeSource([
      { hasNext: false, items: [{ id: 10, userId: 1000 }] }
    ]);

    const result = await runScheduledUidSyncWithDependencies({
      store,
      source,
      sourceName: "test-source",
      maxPages: 5,
      limit: 100
    });

    const state = await store.getSyncState(UID_SCHEDULED_SYNC_OPERATION);
    expect(result.exhausted).toBe(true);
    expect(state?.next_cursor).toBeNull();
  });

  it("preserves previous cursor when a scheduled chunk fails", async () => {
    const store = new FakeStore();
    await store.upsertSyncState({
      operation: UID_SCHEDULED_SYNC_OPERATION,
      nextCursor: "10",
      status: "success",
      lastRunId: 1,
      lastError: null
    });
    const source = {
      async fetchAffiliateUsersPage() {
        throw new Error("source down");
      }
    };

    await expect(runScheduledUidSyncWithDependencies({
      store,
      source,
      sourceName: "test-source",
      maxPages: 5,
      limit: 100
    })).rejects.toThrow("source down");

    const state = await store.getSyncState(UID_SCHEDULED_SYNC_OPERATION);
    expect(state?.status).toBe("failed");
    expect(state?.next_cursor).toBe("10");
    expect(state?.last_error).toBe("source down");
  });
});
