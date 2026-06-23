import { describe, expect, it } from "vitest";
import { USER_INFO_BACKFILL_SYNC_OPERATION, UserInfoBackfillSyncer, UserInfoSyncer, startUserInfoBackfillSync, type UserInfoSyncQueue } from "../src/user-info-sync";
import { FakeStore } from "./fakes";

describe("user info sync", () => {
  it("syncs referral codes for a bounded user chunk", async () => {
    const store = new FakeStore();
    await store.upsertUser({ uid: "6636211405916", affiliateItemId: "1", role: "DIRECTOR", registeredAt: null }, 1, "now");
    await store.upsertUser({ uid: "8726819833312", affiliateItemId: "2", role: "DIRECTOR", registeredAt: null }, 1, "now");

    const source = {
      async fetchUserInfo(uid: string) {
        return {
          uid,
          registerInviteCode: uid === "6636211405916" ? "BOAHBL" : "CRCA"
        };
      }
    };

    const result = await new UserInfoSyncer(source, store, "test-source").syncChunk(1);

    expect(result).toMatchObject({ processed: 1, inserted: 0, updated: 1, skipped: 0 });
    expect(store.userInfos.get("6636211405916")).toMatchObject({ registerInviteCode: "BOAHBL" });
    expect(store.userInfos.has("8726819833312")).toBe(false);
  });

  it("starts referral backfill and prevents duplicate starts while running", async () => {
    const store = new FakeStore();
    const queue = new FakeQueue();

    const first = await startUserInfoBackfillSync({ store, queue, now: new Date("2026-06-23T10:00:00.000Z") });
    const second = await startUserInfoBackfillSync({ store, queue, now: new Date("2026-06-23T10:01:00.000Z") });

    expect(first).toMatchObject({ started: true, operation: USER_INFO_BACKFILL_SYNC_OPERATION });
    expect(second).toMatchObject({ started: false, reason: "already-running" });
    expect(queue.messages).toHaveLength(1);
    expect((await store.getSyncState(USER_INFO_BACKFILL_SYNC_OPERATION))?.status).toBe("running");
  });

  it("continues referral backfill until all pending users are synced", async () => {
    const store = new FakeStore();
    await store.upsertUser({ uid: "100", affiliateItemId: "1", role: "DIRECTOR", registeredAt: null }, 1, "now");
    await store.upsertUser({ uid: "200", affiliateItemId: "2", role: "DIRECTOR", registeredAt: null }, 1, "now");
    await store.upsertUser({ uid: "300", affiliateItemId: "3", role: "DIRECTOR", registeredAt: null }, 1, "now");
    const queue = new FakeQueue();
    const source = {
      async fetchUserInfo(uid: string) {
        return { uid, registerInviteCode: `CODE${uid}` };
      }
    };

    const first = await new UserInfoBackfillSyncer(source, store, queue, "test-source")
      .syncChunk({ startedAt: "2026-06-23T10:00:00.000Z" }, 2);
    const second = await new UserInfoBackfillSyncer(source, store, queue, "test-source")
      .syncChunk(queue.messages[0], 2);

    expect(first).toMatchObject({ processed: 2, exhausted: false });
    expect(second).toMatchObject({ processed: 1, exhausted: true });
    expect(await store.getUserInfoPendingCount()).toBe(0);
    expect((await store.getSyncState(USER_INFO_BACKFILL_SYNC_OPERATION))?.status).toBe("success");
  });
});

class FakeQueue implements UserInfoSyncQueue {
  messages: Array<{ startedAt: string }> = [];

  async send(message: { startedAt: string }): Promise<void> {
    this.messages.push(message);
  }
}
