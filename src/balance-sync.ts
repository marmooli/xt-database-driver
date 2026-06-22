import type { XtDataStore } from "./db";
import type { BalanceSyncResult } from "./types";
import type { XtUserBalanceSource } from "./xt-source";

export class BalanceSyncer {
  constructor(
    private readonly source: XtUserBalanceSource,
    private readonly store: XtDataStore,
    private readonly sourceName = "xt-mcp-http"
  ) {}

  async syncChunk(limit: number): Promise<BalanceSyncResult> {
    const boundedLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
    const runId = await this.store.createSyncRun({
      source: this.sourceName,
      operation: "balance-sync",
      cursorStart: null
    });
    const counts = { processed: 0, inserted: 0, updated: 0, skipped: 0 };

    try {
      const uids = await this.store.listBalanceSyncCandidates({ limit: boundedLimit });
      const now = new Date().toISOString();

      for (const uid of uids) {
        counts.processed += 1;
        const balance = await this.source.fetchUserBalance(uid);
        const result = await this.store.upsertUserBalance(balance, runId, now);
        if (result.inserted) counts.inserted += 1;
        if (result.updated) counts.updated += 1;
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
