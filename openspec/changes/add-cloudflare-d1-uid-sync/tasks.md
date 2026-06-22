## 1. Project and Cloudflare Setup

- [x] 1.1 Add the minimal Cloudflare Worker project structure and package scripts needed to run, test, and deploy the importer.
- [x] 1.2 Add Cloudflare configuration with a D1 binding such as `XT_DB` for the XT data database and variables/secrets for the XT HTTP proxy source.
- [x] 1.3 Document the Wrangler commands for creating the remote D1 database, applying migrations locally, applying migrations remotely, and running local development.
- [x] 1.4 Add secret/config handling for a protected manual import entrypoint.

## 2. D1 Schema

- [x] 2.1 Create the initial D1 migration for `xt_users` with text UID/source id fields, a unique UID key, source metadata fields, and first/last seen timestamps.
- [x] 2.2 Create the initial D1 migration for `sync_runs` with source name, operation, status, cursor range, timestamps, counts, and error details.
- [x] 2.3 Add database access helpers for inserting/updating users and recording sync run lifecycle events.
- [x] 2.4 Add indexes for UID lookup and recent sync run inspection.

## 3. XT UID Source Client

- [x] 3.1 Implement a configurable HTTP source client for reading affiliate user pages from the XT proxy.
- [x] 3.2 Keep the source client behind an adapter boundary so the MCP tool can be used for development inspection without becoming a production dependency.
- [x] 3.3 Normalize `get_all_affiliate_users` items into the minimal UID import shape, converting identifiers to strings.
- [x] 3.4 Handle `limit=100`, cursor advancement, empty pages, malformed items, and source errors in a way the importer can report.

## 4. UID Import Flow

- [x] 4.1 Implement a manually invokable UID import entrypoint for development and production.
- [x] 4.2 Upsert users by UID so repeated runs do not create duplicates.
- [x] 4.3 Record successful and failed import runs with processed, inserted, updated, and skipped counts.
- [x] 4.4 Reject production manual import requests that do not include the configured authorization secret or equivalent admin control.
- [x] 4.5 Add a small verification/readback path to inspect latest import status and user count.

## 5. Verification

- [x] 5.1 Add tests for UID normalization, idempotent upsert behavior, and sync run tracking.
- [x] 5.2 Add tests for pagination stop/continue behavior and unauthorized manual import requests.
- [x] 5.3 Run the D1 migration locally and verify the schema exists.
- [x] 5.4 Run a limited UID import and confirm the expected user count and sync run status are recorded.
- [x] 5.5 Run the full UID import once the limited import is verified and capture observed totals for planning later phases.
