import { HttpXtAffiliateUserSource, McpHttpXtAffiliateUserSource, type XtAffiliateUserSource } from "./xt-source";

export function createXtSource(env: Env): XtAffiliateUserSource {
  if ((env.XT_SOURCE_KIND || "mcp-http") === "mcp-http") {
    return new McpHttpXtAffiliateUserSource(env);
  }

  return new HttpXtAffiliateUserSource(env);
}

export function getSourceName(env: Env): string {
  return (env.XT_SOURCE_KIND || "mcp-http") === "mcp-http" ? "xt-mcp-http" : "xt-http-proxy";
}
