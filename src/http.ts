import { BALANCE_DAILY_SYNC_OPERATION, BalanceSyncer, startDailyBalanceSync } from "./balance-sync";
import { D1XtDataStore } from "./db";
import { renderDashboard } from "./dashboard";
import { UidImporter } from "./importer";
import { createBalanceSource, createUserInfoSource, createXtSource, getSourceName } from "./source-factory";
import { UID_SCHEDULED_SYNC_OPERATION } from "./scheduled";
import { TRADE_DAILY_SYNC_OPERATION, completeGermanyDateWindow, startDailyTradeSync } from "./trade-sync";
import type { UserListSort } from "./types";
import { UserInfoSyncer } from "./user-info-sync";

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname === "/" && request.method === "GET") {
    return renderDashboard();
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

  if (url.pathname === "/admin/users" && request.method === "GET") {
    const unauthorized = requireAdminAuthorization(request, env);
    if (unauthorized) return unauthorized;

    const store = new D1XtDataStore(env.XT_DB);
    const limit = clampInteger(parseOptionalInteger(url.searchParams.get("limit")), 25, 1, 100);
    const offset = clampInteger(parseOptionalInteger(url.searchParams.get("offset")), 0, 0, 1000000);
    const sort = parseUserListSort(url.searchParams.get("sort"));
    const tradeWindow = completeGermanyDateWindow(new Date(), 30);
    const users = await store.listUsers({
      limit,
      offset,
      sort,
      tradeDateStart: tradeWindow.startDate,
      tradeDateEnd: tradeWindow.endDate
    });

    return json({ users, limit, offset, sort, tradeWindow });
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
  return value === "balance_desc" || value === "balance_asc" || value === "trade_30d_desc" ? value : "recent";
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
