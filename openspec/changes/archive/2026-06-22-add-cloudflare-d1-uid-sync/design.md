## Context

The project has an XT proxy available at `https://xt-api.metagitic.com` and an MCP endpoint at `https://xt-api.metagitic.com/mcp`. The current known data shape is documented in `docs/uid-data-schema.json`, including `get_all_affiliate_users` as the first source for UID discovery. The MCP tool schema exposes `get_all_affiliate_users` with `direction`, `fromId`, `startTime`, `endTime`, and `limit`, where `limit` is capped at 100.

The dashboard cannot rely on live XT API calls for every view because it will need responsive reads, local enrichment fields, field-level access rules, and eventually daily historical snapshots. This change creates the first small Cloudflare D1 foundation and imports only the UID list so future phases can enrich the same records with user info, KYC, balance, commissions, rebates, and dashboard-specific metadata.

## Goals / Non-Goals

**Goals:**

- Create a Cloudflare D1-backed schema for the initial XT user catalog.
- Import all available affiliate user UIDs from the XT proxy source.
- Make the import idempotent so the same UID can be seen repeatedly without duplicate rows.
- Record import run status, counts, timestamps, and error details for operational visibility.
- Keep the model extensible for future fields, daily sync, historical snapshots, and dashboard-specific annotations.

**Non-Goals:**

- Build the admin dashboard UI.
- Implement role-based dashboard permissions.
- Import all XT endpoint data in this phase.
- Design final history models for balance, commissions, rebates, trades, or KYC.
- Treat Cloudflare D1 as the authoritative source for XT-owned fields; in this phase it is a local operational copy plus future enrichment base.

## Decisions

### Use Cloudflare D1 for the first storage layer

D1 fits the first phase because the data starts as relational user records and import run metadata. It also keeps the future dashboard close to Cloudflare Workers and scheduled jobs. The implementation should use Cloudflare's D1 binding from the Worker runtime, versioned SQL migrations, and local-first verification before applying migrations to the remote database.

Alternative considered: R2 JSON snapshots. R2 would be useful for raw archival exports, but it would make dashboard queries, UID lookup, and idempotent upserts less direct.

### Store a minimal `xt_users` catalog first

The first user table stores the stable XT UID and the metadata available from `get_all_affiliate_users`: proxy item id, user role, registration time when present, first/last seen timestamps, and source bookkeeping. Future enrichment can add separate tables or nullable columns after requirements are known.

UIDs and source ids should be stored as text, not JavaScript numbers. This avoids accidental precision loss if XT identifiers exceed JavaScript's safe integer range and keeps D1 reads/writes predictable through the Worker binding API.

The first migration should prefer explicit SQLite types and use `STRICT` tables where compatible with the D1 runtime. Suggested initial shape:

- `xt_users`: `uid`, `affiliate_item_id`, `role`, `registered_at`, `first_seen_at`, `last_seen_at`, `last_sync_run_id`, `created_at`, `updated_at`
- `sync_runs`: `id`, `source`, `operation`, `status`, `cursor_start`, `cursor_end`, `started_at`, `finished_at`, `processed_count`, `inserted_count`, `updated_count`, `skipped_count`, `error_message`
- indexes: unique `xt_users.uid`, optional `xt_users.affiliate_item_id`, and `sync_runs.started_at`

Alternative considered: create a wide table for every field in `docs/uid-data-schema.json`. That would overfit the unknown data volume and history strategy before the daily sync behavior is observed.

### Track every import in `sync_runs`

Each migration or sync execution records source name, operation, status, start/end timestamps, cursor range, processed count, inserted count, updated count, skipped count, and error message when applicable. Status values should start narrow: `running`, `success`, and `failed`. This gives us a small operational dashboard surface even before the full admin dashboard exists.

Alternative considered: log only to Worker logs. Logs are useful for debugging but do not provide durable status for later dashboard views.

### Make UID import idempotent

`xt_users.uid` is unique. Imports upsert by UID, preserving `first_seen_at` and updating source metadata plus `last_seen_at`. This allows manual re-runs, partial retries, and future scheduled runs without creating duplicate user rows.

Alternative considered: append every import result as a new row. That would preserve raw observation history but make the first dashboard and enrichment model unnecessarily noisy. If daily history is needed later, it should be added as explicit snapshot tables.

### Start with a manual import command or Worker endpoint before scheduling

The first phase should support a controlled import run that can be invoked manually in development and production. The production entrypoint must be protected by a secret/admin token or be implemented as a non-public command path. A scheduled daily job can be added once pagination behavior, rate limits, and actual record counts are observed.

Alternative considered: add cron scheduling immediately. That adds operational behavior before the first migration path has been validated against real data volume.

### Use MCP-over-HTTP at runtime with a direct proxy adapter boundary

Cloudflare Workers can reliably call the XT MCP endpoint over HTTP JSON-RPC from production. The local MCP tool is useful for Codex-assisted exploration and for confirming tool schemas, but the deployed Worker does not depend on the Codex MCP client being present. The source client therefore exposes an adapter boundary, with the first working production adapter targeting MCP-over-HTTP and a direct proxy adapter available if a simpler route is exposed later.

Alternative considered: use only a direct affiliate-users HTTP route. That would be simpler, but the route is not currently documented; the MCP HTTP route has been verified with `tools/call` for `get_all_affiliate_users`.

### Page with `limit=100` and cursor state

The importer should request pages using the maximum supported page size of 100 and advance with the source cursor fields (`fromId` and `direction=NEXT`, unless the HTTP proxy route requires a different equivalent). It should stop on `hasNext=false` or an empty page and persist the final cursor in `sync_runs.cursor_end`.

Alternative considered: request broad date windows without cursor tracking. That is less useful for restart/debug behavior during the first full import.

## Risks / Trade-offs

- Unknown real data volume -> Keep the first importer paginated/batched and record counts in `sync_runs`.
- XT API pagination or rate limits may be unclear -> Isolate the source client, use `limit=100`, persist cursor metadata, and make import retries idempotent.
- UID fields may have inconsistent naming across endpoints -> Normalize the first table around a single `uid` value and keep raw source identifiers separately.
- Numeric UID precision can be lost in JavaScript -> Normalize identifiers to strings at the source boundary and store them as D1 `TEXT`.
- Sensitive data will appear in later phases -> Do not import email, mobile, KYC, balance, or financial fields in this phase.
- D1 schema may need to evolve as history requirements become clearer -> Keep the first schema narrow and add future tables through migrations.

## Migration Plan

1. Add Cloudflare project configuration with a D1 binding such as `XT_DB`.
2. Create the remote D1 database with Wrangler and commit the returned binding/database metadata to configuration as appropriate for the environment.
3. Add the initial D1 migration for `xt_users` and `sync_runs`.
4. Apply migrations locally first, then apply them to the remote D1 database after local verification.
5. Add an XT HTTP source client for the configured MCP-over-HTTP route used by UID import, keeping an adapter boundary for a future direct proxy route.
6. Add the manual UID import path with pagination, upsert behavior, and sync run tracking.
7. Run the import against a limited dataset first, then run the full UID import.
8. Verify row counts and inspect a sample of imported UIDs.

Rollback is limited to this new data foundation: disable the import entrypoint, export or inspect the current D1 state if needed, and drop or recreate the D1 database if the initial schema is wrong before later phases depend on it.

## Open Questions

- What direct HTTP route, if any, should replace the current MCP-over-HTTP source later?
- Should raw API responses be archived for audit/debugging in a later R2 bucket, or is normalized D1 storage enough for the first migrations?
- Which Cloudflare environment names should be used for development, staging, and production?
