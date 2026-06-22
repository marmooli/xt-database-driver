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

Run a limited UID import locally:

```sh
curl -X POST "http://127.0.0.1:8787/admin/import/uid?maxPages=1&limit=100"
```

Run a protected production import:

```sh
curl -X POST "https://<worker-url>/admin/import/uid?maxPages=1&limit=100" \
  -H "Authorization: Bearer <ADMIN_IMPORT_TOKEN>"
```

Inspect import status:

```sh
curl "http://127.0.0.1:8787/admin/status"
```

## Verification

```sh
npm run typecheck
npm test
```
