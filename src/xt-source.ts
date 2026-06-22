import type {
  FetchAffiliateUsersParams,
  NormalizedXtUser,
  XtUserBalance,
  XtAffiliateUsersPage,
  XtAffiliateUsersResponse,
  XtAffiliateUserItem
} from "./types";

export interface XtAffiliateUserSource {
  fetchAffiliateUsersPage(params: FetchAffiliateUsersParams): Promise<XtAffiliateUsersPage>;
}

export interface XtUserBalanceSource {
  fetchUserBalance(uid: string): Promise<XtUserBalance>;
}

export class XtSourceError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "XtSourceError";
  }
}

export class HttpXtAffiliateUserSource implements XtAffiliateUserSource {
  constructor(private readonly env: Pick<Env, "XT_API_BASE_URL" | "XT_AFFILIATE_USERS_PATH" | "XT_AFFILIATE_USERS_URL" | "XT_HTTP_METHOD" | "XT_API_TOKEN">) {}

  async fetchAffiliateUsersPage(params: FetchAffiliateUsersParams): Promise<XtAffiliateUsersPage> {
    const method = (this.env.XT_HTTP_METHOD || "GET").toUpperCase();
    const url = this.buildUrl(params, method);
    const headers = new Headers({ accept: "application/json" });

    if (method !== "GET") {
      headers.set("content-type", "application/json");
    }

    if (this.env.XT_API_TOKEN) {
      headers.set("authorization", `Bearer ${this.env.XT_API_TOKEN}`);
    }

    const response = await fetch(url, {
      method,
      headers,
      body: method === "GET" ? undefined : JSON.stringify(params)
    });

    if (!response.ok) {
      throw new XtSourceError(`XT source returned HTTP ${response.status}`);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      throw new XtSourceError("XT source returned invalid JSON", error);
    }

    return parseAffiliateUsersResponse(payload);
  }

  private buildUrl(params: FetchAffiliateUsersParams, method: string): string {
    const endpoint = this.env.XT_AFFILIATE_USERS_URL || new URL(this.env.XT_AFFILIATE_USERS_PATH || "/affiliate/users", this.env.XT_API_BASE_URL || "https://xt-api.metagitic.com").toString();
    const url = new URL(endpoint);

    if (method === "GET") {
      url.searchParams.set("limit", String(params.limit));
      url.searchParams.set("direction", params.direction || "NEXT");
      if (params.fromId) url.searchParams.set("fromId", params.fromId);
      if (params.startTime !== undefined) url.searchParams.set("startTime", String(params.startTime));
      if (params.endTime !== undefined) url.searchParams.set("endTime", String(params.endTime));
    }

    return url.toString();
  }
}

export class McpHttpXtAffiliateUserSource implements XtAffiliateUserSource {
  constructor(private readonly env: Pick<Env, "XT_MCP_URL" | "XT_API_TOKEN">) {}

  async fetchAffiliateUsersPage(params: FetchAffiliateUsersParams): Promise<XtAffiliateUsersPage> {
    const headers = new Headers({
      accept: "application/json, text/event-stream",
      "content-type": "application/json"
    });

    if (this.env.XT_API_TOKEN) {
      headers.set("authorization", `Bearer ${this.env.XT_API_TOKEN}`);
    }

    const response = await fetch(this.env.XT_MCP_URL || "https://xt-api.metagitic.com/mcp", {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: crypto.randomUUID(),
        method: "tools/call",
        params: {
          name: "get_all_affiliate_users",
          arguments: toMcpArguments(params)
        }
      })
    });

    if (!response.ok) {
      throw new XtSourceError(`XT MCP source returned HTTP ${response.status}`);
    }

    const text = await response.text();
    const payload = parseMcpHttpPayload(text);
    const content = payload?.result?.content;
    const textContent = Array.isArray(content) ? content.find((item) => item?.type === "text")?.text : undefined;
    if (typeof textContent !== "string") {
      throw new XtSourceError("XT MCP response did not contain text content");
    }

    try {
      return parseAffiliateUsersResponse(JSON.parse(textContent));
    } catch (error) {
      throw new XtSourceError("XT MCP response text was not valid affiliate user JSON", error);
    }
  }
}

export class McpHttpXtUserBalanceSource implements XtUserBalanceSource {
  constructor(private readonly env: Pick<Env, "XT_MCP_URL" | "XT_API_TOKEN">) {}

  async fetchUserBalance(uid: string): Promise<XtUserBalance> {
    const textContent = await callMcpTool(this.env, "get_user_balance", { uid: Number(uid) });

    try {
      return parseUserBalanceResponse(JSON.parse(textContent));
    } catch (error) {
      throw new XtSourceError("XT MCP response text was not valid user balance JSON", error);
    }
  }
}

function toMcpArguments(params: FetchAffiliateUsersParams): Record<string, number | string | undefined> {
  return {
    ...params,
    fromId: params.fromId === undefined ? undefined : Number(params.fromId)
  };
}

export function parseAffiliateUsersResponse(payload: unknown): XtAffiliateUsersPage {
  const wrapped = payload as XtAffiliateUsersResponse;
  const result = wrapped && typeof wrapped === "object" && "result" in wrapped ? wrapped.result : payload;

  if (!result || typeof result !== "object") {
    throw new XtSourceError("XT source response does not contain a result object");
  }

  const page = result as Partial<XtAffiliateUsersPage>;
  if (!Array.isArray(page.items)) {
    throw new XtSourceError("XT source result does not contain an items array");
  }

  return {
    hasPrev: page.hasPrev ?? null,
    hasNext: page.hasNext ?? null,
    items: page.items
  };
}

export function parseUserBalanceResponse(payload: unknown): XtUserBalance {
  const wrapped = payload as { result?: { userId?: number | string | null; role?: string | null; balance?: number | string | null } | null };
  const result = wrapped && typeof wrapped === "object" && "result" in wrapped ? wrapped.result : payload as typeof wrapped.result;

  if (!result || typeof result !== "object") {
    throw new XtSourceError("XT balance response does not contain a result object");
  }

  const uid = normalizeIdentifier(result.userId);
  const balanceText = normalizeIdentifier(result.balance);
  const balance = typeof result.balance === "number" ? result.balance : Number(result.balance);
  if (!uid || !balanceText || !Number.isFinite(balance)) {
    throw new XtSourceError("XT balance response does not contain a valid uid and balance");
  }

  return {
    uid,
    role: typeof result.role === "string" && result.role.length > 0 ? result.role : null,
    balance,
    balanceText
  };
}

async function callMcpTool(env: Pick<Env, "XT_MCP_URL" | "XT_API_TOKEN">, name: string, args: Record<string, unknown>): Promise<string> {
  const headers = new Headers({
    accept: "application/json, text/event-stream",
    "content-type": "application/json"
  });

  if (env.XT_API_TOKEN) {
    headers.set("authorization", `Bearer ${env.XT_API_TOKEN}`);
  }

  const response = await fetch(env.XT_MCP_URL || "https://xt-api.metagitic.com/mcp", {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method: "tools/call",
      params: { name, arguments: args }
    })
  });

  if (!response.ok) {
    throw new XtSourceError(`XT MCP source returned HTTP ${response.status}`);
  }

  const payload = parseMcpHttpPayload(await response.text());
  const content = payload?.result?.content;
  const textContent = Array.isArray(content) ? content.find((item) => item?.type === "text")?.text : undefined;
  if (typeof textContent !== "string") {
    throw new XtSourceError("XT MCP response did not contain text content");
  }

  return textContent;
}

export function parseMcpHttpPayload(text: string): { result?: { content?: Array<{ type?: string; text?: string }> } } {
  const trimmed = text.trim();
  if (trimmed.startsWith("event:") || trimmed.startsWith("data:")) {
    const dataLine = trimmed.split(/\r?\n/).find((line) => line.startsWith("data:"));
    if (!dataLine) {
      throw new XtSourceError("XT MCP event stream did not contain a data line");
    }
    return JSON.parse(dataLine.slice("data:".length).trim());
  }

  return JSON.parse(trimmed);
}

export function normalizeAffiliateUser(item: XtAffiliateUserItem): NormalizedXtUser | null {
  const uidValue = item.userId ?? item.uid;
  const uid = normalizeIdentifier(uidValue);
  if (!uid) return null;

  return {
    uid,
    affiliateItemId: normalizeIdentifier(item.id),
    role: typeof item.role === "string" && item.role.length > 0 ? item.role : null,
    registeredAt: normalizeTimestamp(item.regTime)
  };
}

export function normalizeIdentifier(value: number | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeTimestamp(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
