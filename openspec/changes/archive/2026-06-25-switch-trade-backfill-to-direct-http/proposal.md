## Why

The trade daily sync and trade backfill currently rely on the MCP transport for `get_user_deposit_trading_data`. That path has already shown malformed text payload failures during long backfill runs. The upstream proxy also exposes a direct signed HTTP route for the same trade data, so we can remove an extra transport layer and make trade ingestion more predictable.

## What Changes

- Switch trade daily sync and trade backfill from MCP transport to the direct signed HTTP proxy route for user deposit/trading data.
- Keep the existing trade parsing, snapshot storage, and backfill semantics unchanged.
- Leave other XT data sources on their current transports unless they already have a separate direct HTTP path.

## Capabilities

### Modified Capabilities

- `cloudflare-xt-data-foundation`: trade ingestion now uses the direct HTTP proxy route for user deposit/trading data instead of MCP transport.

## Impact

- `src/xt-source.ts`
- `src/source-factory.ts`
- trade daily sync and historical trade backfill execution paths
- unit tests for the trade source and source selection
- docs describing the active trade transport
