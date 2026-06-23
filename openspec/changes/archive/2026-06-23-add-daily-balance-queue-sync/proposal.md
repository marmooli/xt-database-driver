## Why

Manual balance sync only updates a small chunk of users at a time. Balance sorting and daily operational review need a daily process that refreshes every imported UID without relying on an admin clicking repeatedly.

## What Changes

- Start a daily balance sync from the existing Cloudflare cron trigger.
- Continue the daily sync through a Cloudflare Queue so each Worker execution processes a bounded chunk.
- Track daily balance sync progress in D1 `sync_state` under a dedicated operation.
- Keep the existing manual balance sync endpoint for small on-demand refreshes.

## Out of Scope

- Historical balance snapshots beyond the current latest balance row.
- New dashboard permissions or user roles.
- Syncing any non-balance XT fields.

