## Context

The first remote import succeeded only after the work was split into bounded chunks. A single full import request hit Cloudflare Worker runtime limits and left an incomplete `running` sync run. The deployed Worker now has D1, admin endpoints, and an MCP-over-HTTP source adapter; this change turns the manual chunking lesson into a durable scheduled sync mechanism.

## Goals / Non-Goals

**Goals:**

- Run UID sync automatically on a daily cron trigger.
- Keep each scheduled execution bounded to a small number of source pages.
- Store cursor state in D1 so scheduled chunks can resume across invocations.
- Reset cursor state when the source is exhausted so the next cycle can scan from the newest page again.
- Expose protected admin status/reset controls for scheduled sync state.

**Non-Goals:**

- Import profile, KYC, balance, trade, commission, or rebate details.
- Build dashboard UI.
- Implement queue-based or workflow-based orchestration.
- Guarantee exactly-once source reads; idempotent D1 upserts remain the correctness mechanism.

## Decisions

### Store scheduled cursor state in D1

A new `sync_state` table stores one row per operation, starting with `uid-scheduled-sync`. It records the next cursor, run status, last run id, and timestamps. This keeps schedule state visible and editable through D1 without adding KV or Queues.

Alternative considered: use Worker global memory. That would not survive isolate restarts and would be unsafe for production.

### Run short cron chunks

The scheduled handler runs `maxPages=5` and `limit=100` by default. This mirrors the successful remote recovery path and avoids long Worker requests. The values remain configurable through environment variables.

Alternative considered: one daily full scan. Production already showed that this can exceed runtime limits.

### Reset cursor when the source is exhausted

When a chunk processes fewer rows than `maxPages * limit`, the source is treated as exhausted. The state resets `next_cursor` to null so the next scheduled cycle starts again from the newest page and can pick up new UIDs.

Alternative considered: leave cursor at the oldest seen row forever. That would avoid re-scanning existing users but would miss newly registered UIDs at the top of the source ordering.

### Keep manual admin controls protected

The existing `ADMIN_IMPORT_TOKEN` guard applies to sync state inspection and reset endpoints. Scheduled events do not require an HTTP token because they are invoked by Cloudflare.

Alternative considered: make state endpoints public read-only. Even basic sync metadata can reveal operational behavior, so it should stay behind admin auth.

## Risks / Trade-offs

- Scheduled chunks may take multiple invocations to complete a full scan -> D1 cursor state records progress and each chunk is idempotent.
- Re-scanning from newest after exhaustion updates many existing rows -> Upsert behavior is expected and keeps `last_seen_at` fresh.
- A scheduled run can fail mid-chunk -> The sync state records failure and keeps the prior cursor for retry.
- Cron frequency may be too low for a full daily scan if data grows -> `UID_SYNC_MAX_PAGES` can be increased later, or the design can move to Queues/Workflows.

## Migration Plan

1. Add a D1 migration for `sync_state`.
2. Add state access helpers to D1 store.
3. Add scheduled chunk execution to the Worker.
4. Add cron trigger configuration.
5. Add protected admin endpoints to inspect/reset sync state.
6. Test scheduled chunk progression locally through unit tests.
7. Apply migration and deploy to Cloudflare.

Rollback: remove the cron trigger or deploy the previous Worker version. The `sync_state` table can remain harmlessly unused.

## Open Questions

- Should the daily cron run once per day or more frequently until a full scan completes?
- Should future phases move long-running sync orchestration to Cloudflare Queues or Workflows?
