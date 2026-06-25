## Context

The fee history system already stores daily fee snapshots per UID and date, and it already backfills historical days through bounded queue chunks. The remaining problem is ordering: when the historical backlog is large, processing users in a naïve order makes the earliest useful data arrive slowly.

We already learned from the trade-volume backfill that priority ordering matters, that deterministic continuation matters, and that the backfill cursor must carry enough information to resume safely across Worker invocations.

## Goals / Non-Goals

**Goals:**
- Prioritize historical fee backfill by descending cumulative fee already stored in the database.
- Keep the existing day-by-day backfill semantics unchanged.
- Preserve bounded queue execution and durable cursor progress.
- Make the ordering deterministic for equal or missing cumulative fee values.

**Non-Goals:**
- Do not change the daily fee sync path.
- Do not change how individual daily fee totals are computed.
- Do not add new dashboard behavior in this change.

## Decisions

1. **Use stored daily fee history as the source for cumulative fee ranking**

   The backfill should choose targets from data already in D1 rather than from a new external source or a separate ranking service. Concretely, the ranking should come from cumulative fee totals derived from stored daily fee snapshots for each UID. That keeps the prioritization local, explainable, and aligned with the rest of the app.

   Alternatives considered:
   - Recompute priority from live XT data at backfill time. Rejected because that reintroduces dependency on live calls and makes ordering less stable.
   - Maintain a separate materialized total-fee table. Rejected for now because the daily fee snapshots already contain the necessary source of truth, and the extra storage would be premature until we see scale pressure.

2. **Carry cumulative fee and UID in the backfill cursor**

   The continuation cursor should remember the last processed fee rank and UID so the next queue chunk can resume deterministically without re-scanning from the top in an ambiguous way.

   Alternatives considered:
   - Cursor by UID alone. Rejected because UID order does not preserve priority.
   - Cursor by timestamp or registration date. Rejected because those are not the desired business priority.

3. **Treat zero-fee users as a distinct low-priority tail**

   Users with no stored fee history, or with zero cumulative fee, should be processed after users with positive cumulative fee. This keeps the prioritization focused on the users that are already known to be active.

   Alternatives considered:
   - Interleave zero-fee users with low-fee users. Rejected because it weakens the benefit of priority ordering.
   - Exclude zero-fee users until a later pass. Rejected because the historical backfill must still complete for everyone.

4. **Keep existing chunking and snapshot idempotency unchanged**

   This change only affects who is chosen next. It should not alter the rules for skipping existing snapshots, writing one snapshot per UID/date, or enqueuing follow-up chunks.

## Risks / Trade-offs

- [The ranking query may get heavier as the number of fee snapshots grows] -> Mitigate with an indexed aggregate query and keep the chunk size bounded.
- [Priority order may evolve as new fee snapshots are written during the backfill] -> Mitigate by resuming from the last processed cumulative-fee cursor and keeping the ordering deterministic.
- [Users with no fee history may be delayed until the tail of the run] -> Mitigate by keeping the backfill resumable so a later sweep can still finish the zero-fee tail.
- [Different deployments may have slightly different snapshot completeness while the backlog is running] -> Mitigate by defining the ordering only from stored database state, not live XT calls.

## Migration Plan

1. Update the fee backfill selection logic to rank users by cumulative stored fee and UID tie-break.
2. Deploy the change without altering the daily fee sync path or the stored daily fee schema.
3. Restart the historical fee backfill so it begins using the new priority order.
4. Watch the first chunk or two to confirm the highest-fee users are being selected first.

Rollback:
- Revert the fee backfill selection logic.
- If the backfill is mid-run, reset the fee backfill state before restarting under the old ordering.

## Open Questions

- Should the ranking query be a single aggregate query over daily fee snapshots, or should we introduce a derived summary later if it becomes a bottleneck?
- Do we want the dashboard to surface the current fee-backfill priority basis, or is this purely operational for now?
