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
