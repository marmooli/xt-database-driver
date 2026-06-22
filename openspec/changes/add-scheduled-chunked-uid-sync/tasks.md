## 1. D1 State Schema

- [x] 1.1 Add a D1 migration for `sync_state` with operation key, next cursor, status, last run id, error, and timestamps.
- [x] 1.2 Add D1 store helpers to read, update, fail, and reset scheduled sync state.

## 2. Scheduled Sync Flow

- [x] 2.1 Add a scheduled chunk runner that reads cursor state and invokes UID import with bounded `maxPages` and `limit`.
- [x] 2.2 Clear scheduled cursor state when a chunk reaches source exhaustion.
- [x] 2.3 Preserve cursor state and record failure state when a scheduled chunk fails.
- [x] 2.4 Add Cloudflare cron trigger configuration and environment variables for chunk size.

## 3. Admin Controls

- [x] 3.1 Add a protected admin endpoint to inspect scheduled sync state.
- [x] 3.2 Add a protected admin endpoint to reset scheduled sync state.
- [x] 3.3 Document scheduled sync operation and reset behavior.

## 4. Verification and Deployment

- [x] 4.1 Add tests for scheduled chunk cursor progression, exhaustion reset, and failure preservation.
- [x] 4.2 Add tests for protected scheduled sync state endpoints.
- [x] 4.3 Run typecheck and unit tests.
- [x] 4.4 Apply the D1 migration locally and remotely.
- [x] 4.5 Deploy the Worker and verify remote scheduled sync state endpoints.
