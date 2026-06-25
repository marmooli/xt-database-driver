## 1. Guardrails and Configuration

- [x] 1.1 Add shared heavy-backfill guard logic so trade and fee backfills cannot start at the same time.
- [x] 1.2 Add safe, configurable heavy-backfill chunk limits with a default of 20 and a hard cap of 25 for trade and fee history jobs.
- [x] 1.3 Keep daily sync start paths independent so daily fee and trade refreshes still run during heavy backfills.

## 2. Throughput Improvements

- [x] 2.1 Batch D1 upserts inside each heavy backfill chunk to reduce per-row write overhead.
- [x] 2.2 Add a narrowly bounded XT fetch pool inside heavy backfill chunks with a default of 2 and a hard cap of 4.
- [x] 2.3 Preserve existing snapshot semantics, idempotency, and skip behavior while the new throughput path runs.

## 3. Verification and Rollout

- [x] 3.1 Add tests covering heavy-backfill serialization, chunk clamping, and daily-sync independence.
- [x] 3.2 Add tests covering batched backfill writes and bounded parallel fetch behavior.
- [x] 3.3 Run a live verification on the deployed Worker and confirm the new guardrails, defaults, and throughput settings behave as expected.
