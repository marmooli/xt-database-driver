import { describe, expect, it } from "vitest";
import { requireAdminAuthorization } from "../src/http";

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
