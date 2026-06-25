## Context

The system already runs UID import, daily balance sync, daily trade sync, and the fee sync/backfill flows through Cloudflare queues and D1 sync state. The slowest work is the historical backfill path, where trade and fee history can each span many user-days and still process items mostly one at a time.

We want a faster backfill path without changing the stored data model, breaking daily refresh behavior, or turning a recoverable queue workflow into a risky long-running batch job.

## Goals / Non-Goals

**Goals:**
- Increase heavy backfill throughput with low operational risk.
- Keep trade and fee history backfills from competing with each other.
- Preserve current snapshot semantics and idempotency.
- Reduce per-item overhead in backfill chunk execution.
- Keep daily sync jobs independent so they can continue while a heavy backfill runs.

**Non-Goals:**
- No schema redesign for user history data.
- No UI/dashboard changes in this change.
- No change to what data is captured, only how efficiently it is processed.
- No unbounded parallelism or broad concurrency across the full dataset.

## Decisions

1. **Serialize heavy backfills with a shared guardrail.**
   Trade and fee backfills will check a shared running state before their first chunk is queued. If the other heavy backfill is already active, the new request will be rejected or deferred instead of starting a second heavy backfill.
   - Why: This removes the biggest source of avoidable load contention with very little complexity.
   - Alternatives considered: letting both backfills run and hoping chunk sizing alone is enough; this was rejected because the two jobs are both write-heavy and source-heavy.

2. **Raise heavy backfill chunk limits in a controlled step.**
   The default heavy backfill day limit should move up from the current conservative value to **20 days**, with an environment override and a hard clamp at **25 days**.
   - Why: The current 10-day chunk is safe but slow; a moderate increase yields a meaningful reduction in queue overhead without changing semantics.
   - Alternatives considered: jumping straight to the maximum bound; this was rejected because one failed chunk would become too expensive to retry.

3. **Batch D1 writes per chunk.**
   Backfill chunk processors should write the chunk's eligible snapshot rows through a batched D1 call or a transaction-style unit rather than one write at a time.
   - Why: The work is already chunked; reducing database round-trips is the lowest-risk way to improve throughput inside each chunk.
   - Alternatives considered: schema changes or denormalization to reduce writes; rejected because we want to preserve current history semantics.

4. **Use a small, bounded XT fetch pool only after the write path is batched.**
   Any parallel source fetching should stay tightly capped at **2 concurrent fetches by default** with a hard cap of **4**, and should only be used inside a chunk, not across the whole backfill.
   - Why: This can shave time off source calls while keeping failure domains small.
   - Alternatives considered: full parallel backfill across many users/days; rejected because it would raise source pressure and make retries harder to reason about.

5. **Keep daily sync independent from heavy backfill serialization.**
   Daily fee and trade refreshes remain allowed while a heavy backfill is running.
   - Why: Routine freshness should not wait behind historical catch-up work.
   - Alternatives considered: global single-flight for all sync types; rejected because it would slow down everyday operations unnecessarily.

## Risks / Trade-offs

- [Longer individual chunk runtime] -> Larger chunks can make retries slower and can hold queue workers longer. Mitigation: keep the new ceiling modest, clamp the max, and verify with tests before raising again.
- [Backfill starvation] -> Serializing heavy backfills means one large job can keep another waiting. Mitigation: expose clear state, keep daily jobs independent, and start only one heavy backfill at a time.
- [Source rate pressure] -> Even small parallel fetch pools can stress XT if the pool is too large. Mitigation: keep the concurrency cap low and make it adjustable.
- [D1 write contention] -> Batched writes can still hold locks longer than single-row writes. Mitigation: batch only within a chunk, keep the chunk bounded, and retain the existing idempotent upsert behavior.
- [Operational surprise] -> Changing defaults without visibility could surprise operators. Mitigation: document the new defaults and verify the live worker state after deployment.
- [Misconfigured override] -> An overly large env override could reintroduce slow or unstable chunks. Mitigation: hard clamp the effective chunk size and keep the fetch pool capped.

## Migration Plan

1. Deploy the throughput-guardrail change with conservative defaults.
2. Verify that only one heavy backfill can start at a time and that daily syncs still start normally.
3. Measure chunk duration and queue progress on a live backfill.
4. Increase chunk size or fetch concurrency only if the first live run remains stable.
5. If a regression appears, roll back by redeploying the previous Worker version and restore the prior env limits.

## Open Questions

None. Initial rollout defaults are fixed for implementation:
- heavy backfill chunk size default: 20 days
- heavy backfill chunk size cap: 25 days
- bounded XT fetch pool default: 2
- bounded XT fetch pool cap: 4
- heavy backfill start behavior: hard reject with a clear already-running response when another heavy backfill is active
