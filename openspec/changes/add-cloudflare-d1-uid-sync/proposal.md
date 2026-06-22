## Why

The XT proxy is not a suitable direct data source for an operational dashboard because dashboard views would require repeated API calls, mixed enrichment data, and controlled access to sensitive fields. We need a small Cloudflare D1-backed local data foundation that can start with UID import and grow gradually into daily sync, history reconstruction, and administrative review workflows.

## What Changes

- Add a Cloudflare D1 data foundation for XT-derived records.
- Add the first migration path that imports affiliate user UIDs from the configured XT HTTP source; the initial implementation uses the XT MCP endpoint over HTTP JSON-RPC and keeps a direct proxy adapter available for a future route.
- Track import runs so the system can report when data was fetched, how many records were processed, and whether a run succeeded or failed.
- Store only the initial minimal user identity needed for later enrichment: XT UID plus available affiliate metadata from the UID listing.
- Keep the phase intentionally small; detailed field-level history, dashboard roles, editing workflows, and full daily sync for all endpoint types remain future phases.

## Capabilities

### New Capabilities
- `cloudflare-xt-data-foundation`: Defines the initial D1-backed storage and UID import behavior for XT proxy data.

### Modified Capabilities

None.

## Impact

- Adds Cloudflare D1 as a project data store.
- Adds migration/sync infrastructure that reads from the configured XT HTTP endpoint.
- Adds schema and run tracking for initial UID import.
- Establishes a base for later dashboard, access control, enrichment fields, and daily historical snapshots.
