import { BALANCE_DAILY_SYNC_OPERATION, BalanceSyncer, startDailyBalanceSync } from "./balance-sync";
import { D1XtDataStore } from "./db";
import { renderDashboard, renderReferralCodesPage, renderUserTradePage } from "./dashboard";
import { UidImporter } from "./importer";
import { createBalanceSource, createUserInfoSource, createXtSource, getSourceName } from "./source-factory";
import { UID_SCHEDULED_SYNC_OPERATION } from "./scheduled";
import { TRADE_BACKFILL_SYNC_OPERATION, TRADE_DAILY_SYNC_OPERATION, addDaysToDateString, completeGermanyDateWindow, previousGermanyDate, startDailyTradeSync, startTradeBackfillSync, toGermanyDate } from "./trade-sync";
import type { TradeHistoryGrain, UserDailyTradeHistoryRow, UserListSort, UserReferralCodeFilter, UserTradeHistoryPoint } from "./types";
import { USER_INFO_BACKFILL_SYNC_OPERATION, UserInfoSyncer, startUserInfoBackfillSync } from "./user-info-sync";

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname === "/" && request.method === "GET") {
    return renderDashboard();
  }

  if (url.pathname === "/referrals" && request.method === "GET") {
    return renderReferralCodesPage();
  }

  const userTradePageMatch = url.pathname.match(/^\/users\/([^/]+)\/trade$/);
  if (userTradePageMatch && request.method === "GET") {
    return renderUserTradePage(decodeURIComponent(userTradePageMatch[1]));
  }

  if (url.pathname === "/health" && request.method === "GET") {
    return json({ ok: true });
  }

  if (url.pathname === "/admin/import/uid" && request.method === "POST") {
    const unauthorized = requireAdminAuthorization(request, env);
    if (unauthorized) return unauthorized;

    const importer = new UidImporter(
      createXtSource(env),
      new D1XtDataStore(env.XT_DB),
      getSourceName(env)
    );

    const result = await importer.importAll({
      fromId: url.searchParams.get("fromId") || undefined,
      maxPages: parseOptionalInteger(url.searchParams.get("maxPages")),
      limit: parseOptionalInteger(url.searchParams.get("limit"))
    });

    return json(result, { status: 202 });
  }

  if (url.pathname === "/admin/status" && request.method === "GET") {
    const unauthorized = requireAdminAuthorization(request, env);
    if (unauthorized) return unauthorized;

    const store = new D1XtDataStore(env.XT_DB);
    const [latestRun, userCount] = await Promise.all([
      store.getLatestSyncRun(),
      store.getUserCount()
    ]);

    return json({ userCount, latestRun });
  }

  if (url.pathname === "/admin/sync/uid" && request.method === "GET") {
    const unauthorized = requireAdminAuthorization(request, env);
    if (unauthorized) return unauthorized;

    const store = new D1XtDataStore(env.XT_DB);
    const [state, latestRun, userCount] = await Promise.all([
      store.getSyncState(UID_SCHEDULED_SYNC_OPERATION),
      store.getLatestSyncRun(),
      store.getUserCount()
    ]);

    return json({ userCount, latestRun, state });
  }

  if (url.pathname === "/admin/sync/uid/reset" && request.method === "POST") {
    const unauthorized = requireAdminAuthorization(request, env);
    if (unauthorized) return unauthorized;

    const store = new D1XtDataStore(env.XT_DB);
    await store.resetSyncState(UID_SCHEDULED_SYNC_OPERATION);
    const state = await store.getSyncState(UID_SCHEDULED_SYNC_OPERATION);

    return json({ state });
  }

  if (url.pathname === "/admin/sync/balances" && request.method === "GET") {
    const unauthorized = requireAdminAuthorization(request, env);
    if (unauthorized) return unauthorized;

    const store = new D1XtDataStore(env.XT_DB);
    const [state, userCount] = await Promise.all([
      store.getSyncState(BALANCE_DAILY_SYNC_OPERATION),
      store.getUserCount()
    ]);

    return json({ userCount, state });
  }

  if (url.pathname === "/admin/sync/balances/start" && request.method === "POST") {
    const unauthorized = requireAdminAuthorization(request, env);
    if (unauthorized) return unauthorized;

    const store = new D1XtDataStore(env.XT_DB);
    const result = await startDailyBalanceSync({
      store,
      queue: env.BALANCE_SYNC_QUEUE
    });
    const state = await store.getSyncState(BALANCE_DAILY_SYNC_OPERATION);

    return json({ result, state }, { status: 202 });
  }

  if (url.pathname === "/admin/sync/trades" && request.method === "GET") {
    const unauthorized = requireAdminAuthorization(request, env);
    if (unauthorized) return unauthorized;

    const store = new D1XtDataStore(env.XT_DB);
    const [state, userCount] = await Promise.all([
      store.getSyncState(TRADE_DAILY_SYNC_OPERATION),
      store.getUserCount()
    ]);

    return json({ userCount, state });
  }

  if (url.pathname === "/admin/sync/trade-backfill" && request.method === "GET") {
    const unauthorized = requireAdminAuthorization(request, env);
    if (unauthorized) return unauthorized;

    const store = new D1XtDataStore(env.XT_DB);
    const [state, userCount] = await Promise.all([
      store.getSyncState(TRADE_BACKFILL_SYNC_OPERATION),
      store.getUserCount()
    ]);

    return json({ userCount, state });
  }

  if (url.pathname === "/admin/sync/trades/start" && request.method === "POST") {
    const unauthorized = requireAdminAuthorization(request, env);
    if (unauthorized) return unauthorized;

    const store = new D1XtDataStore(env.XT_DB);
    const result = await startDailyTradeSync({
      store,
      queue: env.TRADE_SYNC_QUEUE
    });
    const state = await store.getSyncState(TRADE_DAILY_SYNC_OPERATION);

    return json({ result, state }, { status: 202 });
  }

  if (url.pathname === "/admin/sync/trade-backfill/start" && request.method === "POST") {
    const unauthorized = requireAdminAuthorization(request, env);
    if (unauthorized) return unauthorized;

    const store = new D1XtDataStore(env.XT_DB);
    const result = await startTradeBackfillSync({
      store,
      queue: env.TRADE_BACKFILL_SYNC_QUEUE
    });
    const state = await store.getSyncState(TRADE_BACKFILL_SYNC_OPERATION);

    return json({ result, state }, { status: 202 });
  }

  if (url.pathname === "/admin/sync/referrals" && request.method === "GET") {
    const unauthorized = requireAdminAuthorization(request, env);
    if (unauthorized) return unauthorized;

    const store = new D1XtDataStore(env.XT_DB);
    const [state, pendingCount, userCount] = await Promise.all([
      store.getSyncState(USER_INFO_BACKFILL_SYNC_OPERATION),
      store.getUserInfoPendingCount(),
      store.getUserCount()
    ]);

    return json({ userCount, pendingCount, state });
  }

  if (url.pathname === "/admin/referrals/codes" && request.method === "GET") {
    const unauthorized = requireAdminAuthorization(request, env);
    if (unauthorized) return unauthorized;

    const store = new D1XtDataStore(env.XT_DB);
    const limit = clampInteger(parseOptionalInteger(url.searchParams.get("limit")), 25, 1, 1000);
    const offset = clampInteger(parseOptionalInteger(url.searchParams.get("offset")), 0, 0, 1000000);
    const [totalCodes, codes] = await Promise.all([
      store.getReferralCodeCount(),
      store.listReferralCodes({ limit, offset })
    ]);

    return json({ totalCodes, limit, offset, codes });
  }

  if (url.pathname === "/admin/sync/referrals/start" && request.method === "POST") {
    const unauthorized = requireAdminAuthorization(request, env);
    if (unauthorized) return unauthorized;

    const store = new D1XtDataStore(env.XT_DB);
    const result = await startUserInfoBackfillSync({
      store,
      queue: env.USER_INFO_SYNC_QUEUE
    });
    const [state, pendingCount] = await Promise.all([
      store.getSyncState(USER_INFO_BACKFILL_SYNC_OPERATION),
      store.getUserInfoPendingCount()
    ]);

    return json({ result, state, pendingCount }, { status: 202 });
  }

  if (url.pathname === "/admin/users" && request.method === "GET") {
    const unauthorized = requireAdminAuthorization(request, env);
    if (unauthorized) return unauthorized;

    const store = new D1XtDataStore(env.XT_DB);
    const limit = clampInteger(parseOptionalInteger(url.searchParams.get("limit")), 25, 1, 100);
    const offset = clampInteger(parseOptionalInteger(url.searchParams.get("offset")), 0, 0, 1000000);
    const sort = parseUserListSort(url.searchParams.get("sort"));
    const referralCodeFilter = parseReferralCodeFilter(url.searchParams);
    const tradeWindow = completeGermanyDateWindow(new Date(), 30);
    const users = await store.listUsers({
      limit,
      offset,
      sort,
      tradeDateStart: tradeWindow.startDate,
      tradeDateEnd: tradeWindow.endDate,
      referralCodeFilter
    });

    return json({ users, limit, offset, sort, referralCodeFilter, tradeWindow });
  }

  const userTradeHistoryMatch = url.pathname.match(/^\/admin\/users\/([^/]+)\/trade-history$/);
  if (userTradeHistoryMatch && request.method === "GET") {
    const unauthorized = requireAdminAuthorization(request, env);
    if (unauthorized) return unauthorized;

    const uid = decodeURIComponent(userTradeHistoryMatch[1]);
    const grain = parseTradeHistoryGrain(url.searchParams.get("grain"));
    const store = new D1XtDataStore(env.XT_DB);
    const profile = await store.getUserTradeProfile(uid);
    if (!profile) {
      return json({ error: "User not found" }, { status: 404 });
    }

    const endDate = previousGermanyDate(new Date());
    const startDate = profile.registered_at
      ? toGermanyDate(new Date(profile.registered_at))
      : profile.first_seen_at.slice(0, 10);
    const boundedStartDate = startDate <= endDate ? startDate : endDate;
    const rows = await store.listUserDailyTradeHistory({ uid, startDate: boundedStartDate, endDate });
    const points = buildTradeHistoryPoints({
      rows,
      grain,
      startDate: boundedStartDate,
      endDate
    });

    return json({ user: profile, grain, startDate: boundedStartDate, endDate, points });
  }

  if (url.pathname === "/admin/balances/sync" && request.method === "POST") {
    const unauthorized = requireAdminAuthorization(request, env);
    if (unauthorized) return unauthorized;

    const limit = clampInteger(parseOptionalInteger(url.searchParams.get("limit")), 25, 1, 100);
    const syncer = new BalanceSyncer(
      createBalanceSource(env),
      new D1XtDataStore(env.XT_DB),
      getSourceName(env)
    );
    const result = await syncer.syncChunk(limit);

    return json(result, { status: 202 });
  }

  if (url.pathname === "/admin/referrals/sync" && request.method === "POST") {
    const unauthorized = requireAdminAuthorization(request, env);
    if (unauthorized) return unauthorized;

    const limit = clampInteger(parseOptionalInteger(url.searchParams.get("limit")), 25, 1, 100);
    const syncer = new UserInfoSyncer(
      createUserInfoSource(env),
      new D1XtDataStore(env.XT_DB),
      getSourceName(env)
    );
    const result = await syncer.syncChunk(limit);

    return json(result, { status: 202 });
  }

  return json({ error: "Not found" }, { status: 404 });
}

export function requireAdminAuthorization(request: Request, env: Pick<Env, "ADMIN_IMPORT_TOKEN" | "ENVIRONMENT">): Response | null {
  const token = env.ADMIN_IMPORT_TOKEN;
  const isProduction = env.ENVIRONMENT === "production";

  if (!token && !isProduction) return null;
  if (!token && isProduction) {
    return json({ error: "ADMIN_IMPORT_TOKEN is required in production" }, { status: 503 });
  }

  const header = request.headers.get("authorization") || "";
  if (header !== `Bearer ${token}`) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

function parseOptionalInteger(value: string | null): number | undefined {
  if (value === null || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
}

function clampInteger(value: number | undefined, fallback: number, min: number, max: number): number {
  if (value === undefined) return fallback;
  return Math.max(min, Math.min(max, value));
}

function parseUserListSort(value: string | null): UserListSort {
  return value === "balance_desc" ||
    value === "balance_asc" ||
    value === "trade_30d_desc" ||
    value === "registered_desc" ||
    value === "registered_asc"
    ? value
    : "recent";
}

function parseReferralCodeFilter(params: URLSearchParams): UserReferralCodeFilter | null {
  if (params.get("referralFilter") !== "1") return null;

  const codes = params
    .getAll("referralCode")
    .map((code) => code.trim())
    .filter((code) => code !== "");

  return {
    codes: Array.from(new Set(codes)),
    includeBlank: params.get("includeBlankReferralCode") === "1"
  };
}

function parseTradeHistoryGrain(value: string | null): TradeHistoryGrain {
  return value === "weekly" || value === "monthly" || value === "yearly" ? value : "daily";
}

function buildTradeHistoryPoints(input: {
  rows: UserDailyTradeHistoryRow[];
  grain: TradeHistoryGrain;
  startDate: string;
  endDate: string;
}): UserTradeHistoryPoint[] {
  const rowsByDate = new Map(input.rows.map((row) => [row.trade_date, row]));
  const buckets = new Map<string, UserTradeHistoryPoint>();

  for (let date = input.startDate; date <= input.endDate; date = addDaysToDateString(date, 1)) {
    const bucketStart = getTradeHistoryBucketStart(date, input.grain);
    const periodStart = bucketStart < input.startDate ? input.startDate : bucketStart;
    const bucketEnd = getTradeHistoryBucketEnd(bucketStart, input.grain);
    const periodEnd = bucketEnd > input.endDate ? input.endDate : bucketEnd;
    const key = `${periodStart}:${periodEnd}`;
    const row = rowsByDate.get(date);
    const existing = buckets.get(key) ?? {
      period_start: periodStart,
      period_end: periodEnd,
      amount: 0,
      amount_text: "0",
      data_days: 0,
      expected_days: 0,
      has_data: false
    };

    existing.expected_days += 1;
    if (row) {
      existing.amount += row.trade_amount;
      existing.data_days += 1;
      existing.has_data = true;
      existing.amount_text = formatAmount(existing.amount);
    }
    buckets.set(key, existing);
  }

  return Array.from(buckets.values()).sort((a, b) => a.period_start.localeCompare(b.period_start));
}

function getTradeHistoryBucketStart(date: string, grain: TradeHistoryGrain): string {
  if (grain === "daily") return date;
  if (grain === "monthly") return `${date.slice(0, 7)}-01`;
  if (grain === "yearly") return `${date.slice(0, 4)}-01-01`;

  const [year, month, day] = date.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = utc.getUTCDay() === 0 ? 7 : utc.getUTCDay();
  return addDaysToDateString(date, 1 - dayOfWeek);
}

function getTradeHistoryBucketEnd(bucketStart: string, grain: TradeHistoryGrain): string {
  if (grain === "daily") return bucketStart;
  if (grain === "weekly") return addDaysToDateString(bucketStart, 6);
  if (grain === "monthly") {
    const [year, month] = bucketStart.split("-").map(Number);
    return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  }
  const year = bucketStart.slice(0, 4);
  return `${year}-12-31`;
}

function formatAmount(value: number): string {
  return Number.isFinite(value) ? value.toFixed(8).replace(/\.?0+$/, "") : "0";
}

function json(body: unknown, init: ResponseInit = {}): Response {
  return Response.json(body, {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...init.headers
    }
  });
}
