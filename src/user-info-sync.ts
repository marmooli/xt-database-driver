import type { XtDataStore } from "./db";
import type { UserInfoSyncResult } from "./types";
import type { XtUserInfoSource } from "./xt-source";

export class UserInfoSyncer {
  constructor(
    private readonly source: XtUserInfoSource,
    private readonly store: XtDataStore,
    private readonly sourceName = "xt-mcp-http"
  ) {}

  async syncChunk(limit: number): Promise<UserInfoSyncResult> {
    const boundedLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
    const runId = await this.store.createSyncRun({
      source: this.sourceName,
      operation: "user-info-sync",
      cursorStart: null
    });
    const counts = { processed: 0, inserted: 0, updated: 0, skipped: 0 };

    try {
      const uids = await this.store.listUserInfoSyncCandidates({ limit: boundedLimit });
      const now = new Date().toISOString();

      for (const uid of uids) {
        counts.processed += 1;
        const info = await this.source.fetchUserInfo(uid);
        const result = await this.store.upsertUserInfo(info, runId, now);
        if (result.inserted) counts.inserted += 1;
        if (result.updated) counts.updated += 1;
        if (!result.inserted && !result.updated) counts.skipped += 1;
      }

      await this.store.finishSyncRun(runId, {
        status: "success",
        cursorEnd: null,
        ...counts
      });

      return { runId, status: "success", ...counts };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.store.failSyncRun(runId, {
        cursorEnd: null,
        errorMessage,
        ...counts
      });
      throw error;
    }
  }
}
