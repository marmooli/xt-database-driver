## Context

The project already uses a signed HTTP proxy for XT referral endpoints, and the upstream API documentation exposes a direct HTTP route for user deposit and trading data. Trade daily sync and historical trade backfill both consume the same user trade source, so changing the transport there can eliminate a flaky MCP hop for the heaviest trade workloads.

## Goals / Non-Goals

**Goals:**
- Use the direct signed HTTP proxy route for trade ingestion.
- Preserve all existing parsing, snapshot semantics, and queue behavior.
- Keep the change narrow and reversible.

**Non-Goals:**
- Do not redesign the data model.
- Do not change balance, fee, user-info, or referral-code sources.
- Do not alter the trade backfill ordering work already in progress.

## Decisions

1. **Use the direct HTTP proxy route for trade source calls**
   Trade data will be fetched from the proxy route that serves user deposit/trading data directly, instead of calling the MCP tool wrapper.
   Alternative considered: keep MCP and add retries. That would reduce failure symptoms but still leave trade ingestion dependent on a more fragile transport for long-running backfills.

2. **Keep the trade response parser unchanged**
   The direct HTTP route returns the same logical fields the existing parser already expects, so we can reuse the current parsing logic.
   Alternative considered: create a new parser. That adds churn without a new data shape.

3. **Switch the shared trade source factory rather than branch inside each job**
   Daily trade sync and historical trade backfill both depend on the same source interface, so changing the factory centralizes the transport decision.
   Alternative considered: wire a separate source only into backfill. That would leave the daily sync on the old path and split the behavior for the same data domain.

## Risks / Trade-offs

- [Proxy route parity] → If the signed HTTP proxy does not fully match the MCP output shape for some edge cases, the parser could still fail. Mitigation: add focused tests against the direct route shape and keep the parser strict.
- [Transport regressions] → Swapping the transport changes how auth and request formatting work. Mitigation: keep the request shape minimal, use the existing proxy base URL and token, and verify against the live worker.
- [Future transport drift] → A direct route can evolve independently of MCP. Mitigation: document the active source and keep the old MCP implementation nearby only if needed for future fallback work.

## Migration Plan

1. Implement the HTTP trade source and switch the factory.
2. Run unit tests to verify the direct route and parser.
3. Deploy the worker and confirm daily trade and backfill jobs use the new source.

Rollback:
- Revert the source factory and trade source implementation to MCP.
- Redeploy the worker.

## Open Questions

- Do we want an explicit config flag to fall back to MCP for trade, or should direct HTTP remain the only supported path?
- Should the docs call out that the trade proxy route is signed proxy infrastructure rather than the official XT API?
