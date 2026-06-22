import type { ImportOptions, ImportResult, XtAffiliateUsersPage } from "./types";
import type { XtDataStore } from "./db";
import type { XtAffiliateUserSource } from "./xt-source";
import { normalizeAffiliateUser } from "./xt-source";

const DEFAULT_PAGE_LIMIT = 100;

export class UidImporter {
  constructor(
    private readonly source: XtAffiliateUserSource,
    private readonly store: XtDataStore,
    private readonly sourceName = "xt-mcp-http"
  ) {}

  async importAll(options: ImportOptions = {}): Promise<ImportResult> {
    const pageLimit = clampPageLimit(options.limit);
    const cursorStart = options.fromId ?? null;
    const runId = await this.store.createSyncRun({
      source: this.sourceName,
      operation: "uid-import",
      cursorStart
    });

    let cursor = cursorStart;
    let cursorEnd = cursorStart;
    let pageCount = 0;
    const counts = { processed: 0, inserted: 0, updated: 0, skipped: 0 };

    try {
      while (true) {
        if (options.maxPages !== undefined && pageCount >= options.maxPages) break;

        const page = await this.source.fetchAffiliateUsersPage({
          direction: "NEXT",
          fromId: cursor ?? undefined,
          limit: pageLimit
        });
        pageCount += 1;

        const pageCursor = await this.processPage(page, runId, counts);
        if (pageCursor) {
          cursor = pageCursor;
          cursorEnd = pageCursor;
        }

        if (!page.hasNext || page.items.length === 0) break;
        if (!pageCursor) break;
      }

      await this.store.finishSyncRun(runId, {
        status: "success",
        cursorEnd,
        ...counts
      });

      return {
        runId,
        status: "success",
        cursorStart,
        cursorEnd,
        ...counts
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.store.failSyncRun(runId, {
        cursorEnd,
        errorMessage,
        ...counts
      });
      throw error;
    }
  }

  private async processPage(page: XtAffiliateUsersPage, runId: number, counts: { processed: number; inserted: number; updated: number; skipped: number }): Promise<string | null> {
    let lastCursor: string | null = null;
    const now = new Date().toISOString();

    for (const item of page.items) {
      counts.processed += 1;
      const normalized = normalizeAffiliateUser(item);
      if (!normalized) {
        counts.skipped += 1;
        continue;
      }

      lastCursor = normalized.affiliateItemId ?? lastCursor;
      const result = await this.store.upsertUser(normalized, runId, now);
      if (result.inserted) counts.inserted += 1;
      if (result.updated) counts.updated += 1;
    }

    return lastCursor;
  }
}

export function clampPageLimit(limit: number | undefined): number {
  if (limit === undefined) return DEFAULT_PAGE_LIMIT;
  if (!Number.isFinite(limit) || limit < 1) return DEFAULT_PAGE_LIMIT;
  return Math.min(Math.trunc(limit), DEFAULT_PAGE_LIMIT);
}
