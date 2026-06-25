import type { XtDataStore } from "./db";

export const HEAVY_BACKFILL_DEFAULT_DAY_LIMIT = 20;
export const HEAVY_BACKFILL_MAX_DAY_LIMIT = 25;
export const HEAVY_BACKFILL_DEFAULT_FETCH_CONCURRENCY = 1;
export const HEAVY_BACKFILL_MAX_FETCH_CONCURRENCY = 4;
export const HEAVY_BACKFILL_DEFAULT_CONTINUE_DELAY_SECONDS = 5;
export const HEAVY_BACKFILL_MAX_CONTINUE_DELAY_SECONDS = 900;
export const HEAVY_BACKFILL_DEFAULT_RATE_LIMIT_RETRY_DELAY_SECONDS = 300;
export const HEAVY_BACKFILL_MAX_RATE_LIMIT_RETRY_DELAY_SECONDS = 3600;

export async function canStartHeavyBackfill(store: Pick<XtDataStore, "getSyncState">, operation: string, conflictingOperation: string): Promise<boolean> {
  const [currentState, conflictingState] = await Promise.all([
    store.getSyncState(operation),
    store.getSyncState(conflictingOperation)
  ]);

  return currentState?.status !== "running" && conflictingState?.status !== "running";
}

export function clampHeavyBackfillDayLimit(limit: number): number {
  return clampBoundedInteger(limit, HEAVY_BACKFILL_DEFAULT_DAY_LIMIT, 1, HEAVY_BACKFILL_MAX_DAY_LIMIT);
}

export function clampHeavyBackfillFetchConcurrency(limit: number): number {
  return clampBoundedInteger(limit, HEAVY_BACKFILL_DEFAULT_FETCH_CONCURRENCY, 1, HEAVY_BACKFILL_MAX_FETCH_CONCURRENCY);
}

export function resolveHeavyBackfillDayLimit(value: string | undefined): number {
  return clampHeavyBackfillDayLimit(parsePositiveInteger(value, HEAVY_BACKFILL_DEFAULT_DAY_LIMIT));
}

export function resolveHeavyBackfillFetchConcurrency(value: string | undefined): number {
  return clampHeavyBackfillFetchConcurrency(parsePositiveInteger(value, HEAVY_BACKFILL_DEFAULT_FETCH_CONCURRENCY));
}

export function resolveHeavyBackfillContinueDelaySeconds(value: string | undefined): number {
  return clampBoundedInteger(
    parseNonNegativeInteger(value, HEAVY_BACKFILL_DEFAULT_CONTINUE_DELAY_SECONDS),
    HEAVY_BACKFILL_DEFAULT_CONTINUE_DELAY_SECONDS,
    0,
    HEAVY_BACKFILL_MAX_CONTINUE_DELAY_SECONDS
  );
}

export function resolveHeavyBackfillRateLimitRetryDelaySeconds(value: string | undefined, sourceRetryAfterSeconds?: number): number {
  const configured = parsePositiveInteger(value, sourceRetryAfterSeconds ?? HEAVY_BACKFILL_DEFAULT_RATE_LIMIT_RETRY_DELAY_SECONDS);
  return clampBoundedInteger(
    configured,
    HEAVY_BACKFILL_DEFAULT_RATE_LIMIT_RETRY_DELAY_SECONDS,
    1,
    HEAVY_BACKFILL_MAX_RATE_LIMIT_RETRY_DELAY_SECONDS
  );
}

export async function mapWithConcurrency<T, U>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<U>
): Promise<U[]> {
  const boundedConcurrency = clampBoundedInteger(concurrency, 1, 1, HEAVY_BACKFILL_MAX_FETCH_CONCURRENCY);
  const results = new Array<U>(items.length);
  let nextIndex = 0;

  const workers = Array.from({ length: Math.min(boundedConcurrency, items.length) }, async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) {
        return;
      }

      results[index] = await mapper(items[index], index);
    }
  });

  await Promise.all(workers);
  return results;
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseNonNegativeInteger(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function clampBoundedInteger(value: number, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}
