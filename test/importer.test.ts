import { describe, expect, it } from "vitest";
import { UidImporter, clampPageLimit } from "../src/importer";
import { McpHttpXtAffiliateUserSource, normalizeAffiliateUser, parseAffiliateUsersResponse, parseMcpHttpPayload, parseUserBalanceResponse, parseUserDailyTradeResponse } from "../src/xt-source";
import { FakeSource, FakeStore } from "./fakes";

describe("UID import", () => {
  it("normalizes identifiers to strings", () => {
    expect(normalizeAffiliateUser({
      id: 3679948,
      userId: 9988531684897,
      role: "DIRECTOR",
      regTime: 1782114899000
    })).toEqual({
      uid: "9988531684897",
      affiliateItemId: "3679948",
      role: "DIRECTOR",
      registeredAt: 1782114899000
    });
  });

  it("upserts duplicate UIDs and tracks run counts", async () => {
    const store = new FakeStore();
    const source = new FakeSource([
      {
        hasNext: false,
        items: [
          { id: 1, userId: 100, role: "DIRECTOR" },
          { id: 2, userId: 100, role: "MEMBER" },
          { id: 3, userId: null, role: "MEMBER" }
        ]
      }
    ]);

    const result = await new UidImporter(source, store).importAll();

    expect(result).toMatchObject({
      status: "success",
      processed: 3,
      inserted: 1,
      updated: 1,
      skipped: 1,
      cursorEnd: "2"
    });
    expect(await store.getUserCount()).toBe(1);
    expect(store.users.get("100")?.role).toBe("MEMBER");
  });

  it("continues pagination while source has next pages", async () => {
    const store = new FakeStore();
    const source = new FakeSource([
      { hasNext: true, items: [{ id: 10, userId: 1000 }] },
      { hasNext: false, items: [{ id: 20, userId: 2000 }] }
    ]);

    const result = await new UidImporter(source, store).importAll({ limit: 500 });

    expect(result.cursorEnd).toBe("20");
    expect(source.calls).toEqual([
      { direction: "NEXT", fromId: undefined, limit: 100 },
      { direction: "NEXT", fromId: "10", limit: 100 }
    ]);
  });

  it("stops at maxPages for limited verification imports", async () => {
    const store = new FakeStore();
    const source = new FakeSource([
      { hasNext: true, items: [{ id: 10, userId: 1000 }] },
      { hasNext: true, items: [{ id: 20, userId: 2000 }] }
    ]);

    const result = await new UidImporter(source, store).importAll({ maxPages: 1 });

    expect(result.processed).toBe(1);
    expect(source.calls).toHaveLength(1);
  });

  it("parses wrapped XT proxy responses", () => {
    expect(parseAffiliateUsersResponse({
      rc: 0,
      mc: "SUCCESS",
      result: {
        hasPrev: false,
        hasNext: true,
        items: [{ id: 1, userId: 2 }]
      }
    })).toEqual({
      hasPrev: false,
      hasNext: true,
      items: [{ id: 1, userId: 2 }]
    });
  });

  it("parses MCP HTTP event-stream responses", () => {
    const payload = parseMcpHttpPayload(
      'event: message\ndata: {"result":{"content":[{"type":"text","text":"{}"}]},"jsonrpc":"2.0","id":1}\n\n'
    );

    expect(payload.result?.content?.[0]?.text).toBe("{}");
  });

  it("sends MCP cursor arguments as numbers", async () => {
    const calls: unknown[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(JSON.parse(String(init?.body)));
      return new Response(
        'event: message\ndata: {"result":{"content":[{"type":"text","text":"{\\"rc\\":0,\\"result\\":{\\"hasNext\\":false,\\"items\\":[]}}"}]},"jsonrpc":"2.0","id":1}\n\n',
        { status: 200 }
      );
    }) as typeof fetch;

    try {
      await new McpHttpXtAffiliateUserSource({ XT_MCP_URL: "https://example.com/mcp" }).fetchAffiliateUsersPage({
        direction: "NEXT",
        fromId: "3676154",
        limit: 100
      });
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(calls[0]).toMatchObject({
      params: {
        arguments: {
          fromId: 3676154
        }
      }
    });
  });

  it("clamps page size to the XT maximum", () => {
    expect(clampPageLimit(undefined)).toBe(100);
    expect(clampPageLimit(0)).toBe(100);
    expect(clampPageLimit(50)).toBe(50);
    expect(clampPageLimit(101)).toBe(100);
  });

  it("parses user balance responses", () => {
    expect(parseUserBalanceResponse({
      rc: 0,
      result: {
        userId: 5979787691817,
        role: "DIRECTOR",
        balance: 3403.8238
      }
    })).toEqual({
      uid: "5979787691817",
      role: "DIRECTOR",
      balance: 3403.8238,
      balanceText: "3403.8238"
    });
  });

  it("parses user daily trade responses", () => {
    expect(parseUserDailyTradeResponse({
      rc: 0,
      result: {
        userId: 6636211405916,
        role: "DIRECTOR",
        trade: true,
        tradeAmount: "1885244.91821000"
      }
    })).toEqual({
      uid: "6636211405916",
      role: "DIRECTOR",
      trade: true,
      tradeAmount: 1885244.91821,
      tradeAmountText: "1885244.91821000"
    });
  });
});
