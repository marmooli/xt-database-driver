import { describe, expect, it } from "vitest";
import { handleRequest, requireAdminAuthorization } from "../src/http";

describe("admin authorization", () => {
  it("allows local requests when no token is configured", () => {
    const request = new Request("https://example.com/admin/import/uid", { method: "POST" });
    expect(requireAdminAuthorization(request, { ENVIRONMENT: "development" })).toBeNull();
  });

  it("rejects production requests when no token is configured", async () => {
    const request = new Request("https://example.com/admin/import/uid", { method: "POST" });
    const response = requireAdminAuthorization(request, { ENVIRONMENT: "production" });
    expect(response?.status).toBe(503);
    await expect(response?.json()).resolves.toEqual({ error: "ADMIN_IMPORT_TOKEN is required in production" });
  });

  it("rejects requests with the wrong bearer token", () => {
    const request = new Request("https://example.com/admin/import/uid", {
      method: "POST",
      headers: { authorization: "Bearer wrong" }
    });
    const response = requireAdminAuthorization(request, {
      ENVIRONMENT: "production",
      ADMIN_IMPORT_TOKEN: "secret"
    });
    expect(response?.status).toBe(401);
  });

  it("allows requests with the configured bearer token", () => {
    const request = new Request("https://example.com/admin/import/uid", {
      method: "POST",
      headers: { authorization: "Bearer secret" }
    });
    expect(requireAdminAuthorization(request, {
      ENVIRONMENT: "production",
      ADMIN_IMPORT_TOKEN: "secret"
    })).toBeNull();
  });
});

describe("sync state admin endpoints", () => {
  it("serves the dashboard page", async () => {
    const response = await handleRequest(
      new Request("https://example.com/"),
      {} as Env
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    await expect(response.text()).resolves.toContain("XT Data Dashboard");
  });

  it("serves the referral codes page", async () => {
    const response = await handleRequest(
      new Request("https://example.com/referrals"),
      {} as Env
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    await expect(response.text()).resolves.toContain("XT Referral Codes");
  });

  it("serves the user trade history page", async () => {
    const response = await handleRequest(
      new Request("https://example.com/users/100/trade"),
      {} as Env
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    await expect(response.text()).resolves.toContain("UID 100");
  });

  it("rejects unauthorized sync state requests", async () => {
    const response = await handleRequest(
      new Request("https://example.com/admin/sync/uid"),
      {
        ENVIRONMENT: "production",
        ADMIN_IMPORT_TOKEN: "secret"
      } as Env
    );

    expect(response.status).toBe(401);
  });

  it("rejects unauthorized user list requests", async () => {
    const response = await handleRequest(
      new Request("https://example.com/admin/users"),
      {
        ENVIRONMENT: "production",
        ADMIN_IMPORT_TOKEN: "secret"
      } as Env
    );

    expect(response.status).toBe(401);
  });

  it("returns bounded user list data for authorized admins", async () => {
    const db = {
      prepare(sql: string) {
        return {
          bind() {
            return this;
          },
          async all() {
            expect(sql).toContain("FROM xt_users");
            return {
              results: [{
                uid: "100",
                affiliate_item_id: "1",
                role: "DIRECTOR",
                register_invite_code: "BOAHBL",
                last_user_info_sync_at: "d",
                registered_at: 123,
                first_seen_at: "a",
                last_seen_at: "b",
                last_sync_run_id: 1,
                created_at: "a",
                updated_at: "b",
                balance: 10,
                balance_text: "10",
                last_balance_sync_at: "c",
                trade_30d_amount: 123,
                trade_30d_amount_text: "123"
              }]
            };
          }
        };
      }
    } as unknown as D1Database;

    const response = await handleRequest(
      new Request("https://example.com/admin/users?limit=500&offset=0", {
        headers: { authorization: "Bearer secret" }
      }),
      {
        XT_DB: db,
        ENVIRONMENT: "production",
        ADMIN_IMPORT_TOKEN: "secret"
      } as Env
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      limit: 100,
      tradeWindow: { startDate: expect.any(String), endDate: expect.any(String) },
      users: [{ uid: "100", trade_30d_amount: 123 }]
    });
  });

  it("rejects unauthorized balance sync requests", async () => {
    const response = await handleRequest(
      new Request("https://example.com/admin/balances/sync", { method: "POST" }),
      {
        ENVIRONMENT: "production",
        ADMIN_IMPORT_TOKEN: "secret"
      } as Env
    );

    expect(response.status).toBe(401);
  });

  it("rejects unauthorized referral sync requests", async () => {
    const response = await handleRequest(
      new Request("https://example.com/admin/referrals/sync", { method: "POST" }),
      {
        ENVIRONMENT: "production",
        ADMIN_IMPORT_TOKEN: "secret"
      } as Env
    );

    expect(response.status).toBe(401);
  });

  it("returns referral code data for authorized admins", async () => {
    const db = {
      prepare(sql: string) {
        return {
          bind() {
            return this;
          },
          async first() {
            if (sql.includes("COUNT(DISTINCT register_invite_code)")) {
              return { count: 2 };
            }
            return null;
          },
          async all() {
            expect(sql).toContain("GROUP BY register_invite_code");
            return {
              results: [
                { code: "BOAHBL", users: 2 },
                { code: "XRDKVB", users: 1 }
              ]
            };
          }
        };
      }
    } as unknown as D1Database;

    const response = await handleRequest(
      new Request("https://example.com/admin/referrals/codes?limit=25&offset=0", {
        headers: { authorization: "Bearer secret" }
      }),
      {
        XT_DB: db,
        ENVIRONMENT: "production",
        ADMIN_IMPORT_TOKEN: "secret"
      } as Env
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      totalCodes: 2,
      codes: [
        { code: "BOAHBL", users: 2 },
        { code: "XRDKVB", users: 1 }
      ]
    });
  });

  it("returns user trade history with missing days distinguished from zero", async () => {
    const db = {
      prepare(sql: string) {
        return {
          bind() {
            return this;
          },
          async first() {
            if (sql.includes("FROM xt_users")) {
              return {
                uid: "100",
                registered_at: Date.UTC(2026, 5, 22),
                first_seen_at: "2026-06-22T00:00:00.000Z"
              };
            }
            return null;
          },
          async all() {
            expect(sql).toContain("FROM xt_user_trade_daily_snapshots");
            return {
              results: [
                { trade_date: "2026-06-22", trade_amount: 0, trade_amount_text: "0" },
                { trade_date: "2026-06-23", trade_amount: 25, trade_amount_text: "25" }
              ]
            };
          }
        };
      }
    } as unknown as D1Database;

    const response = await handleRequest(
      new Request("https://example.com/admin/users/100/trade-history?grain=daily", {
        headers: { authorization: "Bearer secret" }
      }),
      {
        XT_DB: db,
        ENVIRONMENT: "production",
        ADMIN_IMPORT_TOKEN: "secret"
      } as Env
    );

    expect(response.status).toBe(200);
    const body = await response.json() as {
      points: Array<{ period_start: string; amount: number; has_data: boolean }>;
    };
    expect(body.points).toEqual(expect.arrayContaining([
      expect.objectContaining({ period_start: "2026-06-22", amount: 0, has_data: true }),
      expect.objectContaining({ period_start: "2026-06-23", amount: 25, has_data: true })
    ]));
  });

  it("rejects unauthorized daily balance sync start requests", async () => {
    const response = await handleRequest(
      new Request("https://example.com/admin/sync/balances/start", { method: "POST" }),
      {
        ENVIRONMENT: "production",
        ADMIN_IMPORT_TOKEN: "secret"
      } as Env
    );

    expect(response.status).toBe(401);
  });

  it("rejects unauthorized daily trade sync start requests", async () => {
    const response = await handleRequest(
      new Request("https://example.com/admin/sync/trades/start", { method: "POST" }),
      {
        ENVIRONMENT: "production",
        ADMIN_IMPORT_TOKEN: "secret"
      } as Env
    );

    expect(response.status).toBe(401);
  });

  it("rejects unauthorized referral backfill start requests", async () => {
    const response = await handleRequest(
      new Request("https://example.com/admin/sync/referrals/start", { method: "POST" }),
      {
        ENVIRONMENT: "production",
        ADMIN_IMPORT_TOKEN: "secret"
      } as Env
    );

    expect(response.status).toBe(401);
  });

  it("starts daily balance sync for authorized admins", async () => {
    const messages: unknown[] = [];
    const db = {
      prepare(sql: string) {
        return {
          bind() {
            return this;
          },
          async first() {
            if (sql.includes("SELECT operation")) {
              return null;
            }
            return { count: 10 };
          },
          async run() {
            return { meta: {} };
          }
        };
      }
    } as unknown as D1Database;

    const response = await handleRequest(
      new Request("https://example.com/admin/sync/balances/start", {
        method: "POST",
        headers: { authorization: "Bearer secret" }
      }),
      {
        XT_DB: db,
        BALANCE_SYNC_QUEUE: {
          async send(message: unknown) {
            messages.push(message);
            return {};
          }
        },
        ENVIRONMENT: "production",
        ADMIN_IMPORT_TOKEN: "secret"
      } as Env
    );

    expect(response.status).toBe(202);
    expect(messages).toHaveLength(1);
    await expect(response.json()).resolves.toMatchObject({
      result: { started: true, operation: "balance-daily-sync" }
    });
  });

  it("resets scheduled sync state for authorized admins", async () => {
    const calls: string[] = [];
    const db = {
      prepare(sql: string) {
        calls.push(sql);
        return {
          bind() {
            return this;
          },
          async run() {
            return { meta: {} };
          },
          async first() {
            return {
              operation: "uid-scheduled-sync",
              next_cursor: null,
              status: "idle",
              last_run_id: null,
              last_error: null,
              last_started_at: null,
              last_finished_at: null,
              updated_at: "now"
            };
          }
        };
      }
    } as unknown as D1Database;

    const response = await handleRequest(
      new Request("https://example.com/admin/sync/uid/reset", {
        method: "POST",
        headers: { authorization: "Bearer secret" }
      }),
      {
        XT_DB: db,
        ENVIRONMENT: "production",
        ADMIN_IMPORT_TOKEN: "secret"
      } as Env
    );

    expect(response.status).toBe(200);
    expect(calls.some((sql) => sql.includes("sync_state"))).toBe(true);
  });
});
