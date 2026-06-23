# Cloudflare D1 UID Sync

This project imports XT affiliate UIDs into Cloudflare D1 as the first step toward a local dashboard data foundation.

## Setup

Install dependencies:

```sh
npm install
```

Create the remote D1 database:

```sh
npx wrangler d1 create xt-data
```

Copy the returned `database_id` into `wrangler.jsonc` under the `XT_DB` binding.

Configure production secrets:

```sh
npx wrangler secret put ADMIN_IMPORT_TOKEN
npx wrangler secret put XT_API_TOKEN
```

`XT_API_TOKEN` is optional if the XT proxy route does not require bearer auth.

The default source mode is `XT_SOURCE_KIND=mcp-http`, which calls `https://xt-api.metagitic.com/mcp` using HTTP JSON-RPC and the `get_all_affiliate_users` tool. If you later expose a direct HTTP route for affiliate users, set `XT_SOURCE_KIND=proxy-http` and configure either `XT_AFFILIATE_USERS_PATH` or a full `XT_AFFILIATE_USERS_URL`.

## Migrations

Apply migrations locally:

```sh
npm run db:migrate:local
```

Apply migrations remotely:

```sh
npm run db:migrate:remote
```

## Development

Run the Worker locally:

```sh
npm run dev
```

Open the dashboard locally:

```text
http://127.0.0.1:8787/
```

Run a limited UID import locally:

```sh
curl -X POST "http://127.0.0.1:8787/admin/import/uid?maxPages=1&limit=100"
```

Run a protected production limited import:

```sh
curl -X POST "https://<worker-url>/admin/import/uid?maxPages=1&limit=100" \
  -H "Authorization: Bearer <ADMIN_IMPORT_TOKEN>"
```

For a full production import, run bounded chunks rather than one long request. Use the `cursorEnd` returned by one request as the next request's `fromId` until the response processes fewer records than `maxPages * limit`.

```sh
curl -X POST "https://<worker-url>/admin/import/uid?fromId=<cursorEnd>&maxPages=5&limit=100" \
  -H "Authorization: Bearer <ADMIN_IMPORT_TOKEN>"
```

Inspect import status:

```sh
curl "http://127.0.0.1:8787/admin/status"
```

For production status, include the admin token:

```sh
curl "https://<worker-url>/admin/status" \
  -H "Authorization: Bearer <ADMIN_IMPORT_TOKEN>"
```

## Scheduled Sync

The Worker has a daily cron trigger configured for `02:00 UTC`.

Each scheduled invocation imports a bounded chunk instead of trying to scan every UID in one Worker execution. The defaults are:

```text
UID_SYNC_MAX_PAGES=5
UID_SYNC_LIMIT=100
```

The scheduled cursor is stored in D1 table `sync_state` under operation `uid-scheduled-sync`. When the source is exhausted, the cursor is cleared so the next scheduled cycle starts again from the newest source page.

Inspect scheduled sync state:

```sh
curl "https://<worker-url>/admin/sync/uid" \
  -H "Authorization: Bearer <ADMIN_IMPORT_TOKEN>"
```

Reset scheduled sync state:

```sh
curl -X POST "https://<worker-url>/admin/sync/uid/reset" \
  -H "Authorization: Bearer <ADMIN_IMPORT_TOKEN>"
```

## Balance Sync

Balance sync stores the latest known current balance per UID in `xt_user_balances`. It is intentionally bounded because `get_user_balance` is a per-user source call.

Daily balance sync starts from the existing `02:00 UTC` cron and continues through the Cloudflare Queue named `xt-balance-sync`. Each queue message processes a bounded chunk, then enqueues the next chunk until all imported UIDs have been refreshed for the day.

The defaults are:

```text
BALANCE_SYNC_CHUNK_LIMIT=100
```

Daily progress is stored in D1 table `sync_state` under operation `balance-daily-sync`.

Each daily balance result is also stored in `xt_user_balance_snapshots` with one row per `uid` and Germany-local `snapshot_date` (`Europe/Berlin`). Manual balance sync updates only the latest balance table and does not write daily history. If a UID is not processed by the daily job on a date, no snapshot row is created for that UID/date.

Inspect daily balance sync state:

```sh
curl "https://<worker-url>/admin/sync/balances" \
  -H "Authorization: Bearer <ADMIN_IMPORT_TOKEN>"
```

Start the daily balance sync manually:

```sh
curl -X POST "https://<worker-url>/admin/sync/balances/start" \
  -H "Authorization: Bearer <ADMIN_IMPORT_TOKEN>"
```

Run a protected balance sync chunk:

```sh
curl -X POST "https://<worker-url>/admin/balances/sync?limit=25" \
  -H "Authorization: Bearer <ADMIN_IMPORT_TOKEN>"
```

List users sorted by balance:

```sh
curl "https://<worker-url>/admin/users?sort=balance_desc&limit=25" \
  -H "Authorization: Bearer <ADMIN_IMPORT_TOKEN>"
```

## Referral Code Sync

Referral code sync stores the XT `registerInviteCode` returned by `get_user_info` on the imported `xt_users` row. It is intentionally bounded because user info is a per-user source call.

Run a protected referral-code sync chunk:

```sh
curl -X POST "https://<worker-url>/admin/referrals/sync?limit=25" \
  -H "Authorization: Bearer <ADMIN_IMPORT_TOKEN>"
```

The dashboard includes a `Sync Referrals` action and displays the stored code in the `Referral Code` column.

## Trade Volume Sync

Daily trade sync stores per-user trade volume in `xt_user_trade_daily_snapshots`. It targets the previous complete Germany-local day (`Europe/Berlin`) so daily charts use complete days rather than partial same-day values.

Daily trade sync starts from the existing `02:00 UTC` cron and continues through the Cloudflare Queue named `xt-trade-sync`.

The defaults are:

```text
TRADE_SYNC_CHUNK_LIMIT=10
```

Daily progress is stored in D1 table `sync_state` under operation `trade-daily-sync`.

Inspect daily trade sync state:

```sh
curl "https://<worker-url>/admin/sync/trades" \
  -H "Authorization: Bearer <ADMIN_IMPORT_TOKEN>"
```

Start the daily trade sync manually:

```sh
curl -X POST "https://<worker-url>/admin/sync/trades/start" \
  -H "Authorization: Bearer <ADMIN_IMPORT_TOKEN>"
```

## Current Remote Deployment

- Worker URL: `https://xt-database-driver.hamed-saffarian.workers.dev`
- Dashboard URL: `https://xt-database-driver.hamed-saffarian.workers.dev/`
- D1 database: `xt-data`
- D1 database ID: `8015942b-c844-453e-8ba2-9c5b727d1f2b`
- Initial remote import result: `9345` users in `xt_users`

## Verification

```sh
npm run typecheck
npm test
```
