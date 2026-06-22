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
