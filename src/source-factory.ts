import { HttpXtAffiliateUserSource, McpHttpXtAffiliateUserSource, McpHttpXtUserBalanceSource, McpHttpXtUserInfoSource, McpHttpXtUserTradeSource, type XtAffiliateUserSource, type XtUserBalanceSource, type XtUserInfoSource, type XtUserTradeSource } from "./xt-source";

export function createXtSource(env: Env): XtAffiliateUserSource {
  if ((env.XT_SOURCE_KIND || "mcp-http") === "mcp-http") {
    return new McpHttpXtAffiliateUserSource(env);
  }

  return new HttpXtAffiliateUserSource(env);
}

export function getSourceName(env: Env): string {
  return (env.XT_SOURCE_KIND || "mcp-http") === "mcp-http" ? "xt-mcp-http" : "xt-http-proxy";
}

export function createBalanceSource(env: Env): XtUserBalanceSource {
  return new McpHttpXtUserBalanceSource(env);
}

export function createTradeSource(env: Env): XtUserTradeSource {
  return new McpHttpXtUserTradeSource(env);
}

export function createUserInfoSource(env: Env): XtUserInfoSource {
  return new McpHttpXtUserInfoSource(env);
}
