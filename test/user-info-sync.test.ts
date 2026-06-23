import { describe, expect, it } from "vitest";
import { UserInfoSyncer } from "../src/user-info-sync";
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
});
