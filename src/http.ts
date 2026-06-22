import { D1XtDataStore } from "./db";
import { UidImporter } from "./importer";
import { HttpXtAffiliateUserSource, McpHttpXtAffiliateUserSource, type XtAffiliateUserSource } from "./xt-source";

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

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

  return json({ error: "Not found" }, { status: 404 });
}

function createXtSource(env: Env): XtAffiliateUserSource {
  if ((env.XT_SOURCE_KIND || "mcp-http") === "mcp-http") {
    return new McpHttpXtAffiliateUserSource(env);
  }

  return new HttpXtAffiliateUserSource(env);
}

function getSourceName(env: Env): string {
  return (env.XT_SOURCE_KIND || "mcp-http") === "mcp-http" ? "xt-mcp-http" : "xt-http-proxy";
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

function json(body: unknown, init: ResponseInit = {}): Response {
  return Response.json(body, {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...init.headers
    }
  });
}
