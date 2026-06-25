## Context

The historical trade-volume backfill already fills missing daily trade snapshots from each user's registration date through yesterday. The current progression order is UID-based, which makes early backfill progress favor arbitrary users instead of the users whose data is most valuable to have first.

We already store daily trade snapshots in D1, so cumulative trade volume can be derived from existing data without introducing a new upstream dependency. The change needs to stay low-risk and preserve idempotent snapshot creation.

## Goals / Non-Goals

**Goals:**
- Prioritize historical trade backfill by cumulative trade volume stored in the database.
- Keep the backfill deterministic and resumable.
- Preserve existing per-day snapshot semantics and skip behavior.

**Non-Goals:**
- Do not change how daily trade snapshots are fetched or stored.
- Do not add a new dashboard surface for the new ordering.
- Do not introduce a separate materialized ranking table in the first iteration.

## Decisions

1. **Order users by cumulative stored trade volume, then UID**
   The backfill will choose the next user from a descending cumulative trade-volume ranking, with UID ascending as the deterministic tie-breaker.
   Alternative considered: keep UID order and only prioritize a subset of the first chunk. That would not reliably surface high-volume users early enough.

2. **Derive the ranking from existing trade snapshots**
   The implementation will compute cumulative trade volume from `xt_user_trade_daily_snapshots` joined to `xt_users` instead of adding a new summary table.
   Alternative considered: add a denormalized total-volume table maintained on every trade write. That would reduce ranking-query cost but adds migration and consistency risk for a first pass.

3. **Carry the volume cursor alongside the UID cursor**
   The backfill queue/state will store enough information to resume in the ordered list: the last processed cumulative volume and UID.
   Alternative considered: store only the UID. That is insufficient once the ordering is no longer UID-based.

4. **Keep the priority recalculated per chunk**
   The ordered candidate list is recalculated when selecting the next user. This keeps the implementation simple and avoids a separate queue ledger.
   Alternative considered: snapshot the whole order at backfill start. That would be more stable but more complex and harder to resume safely.

## Risks / Trade-offs

- [Aggregate query cost] → The next-user lookup will scan and aggregate existing trade snapshots. Mitigation: keep the implementation simple for now and revisit a materialized total table only if the ranking query becomes a bottleneck.
- [Ordering shifts while a long backfill runs] → Cumulative volumes can change as daily data continues to arrive. Mitigation: the backfill remains idempotent and skips already stored dates, so the outcome stays correct even if later priorities move slightly.
- [Rollback complexity] → The new cursor format depends on volume-aware ordering. Mitigation: document that a rollback may require clearing the running backfill state before restarting the old version.

## Migration Plan

1. Deploy the code and spec change together.
2. Restart the historical trade backfill so it begins using the new volume-prioritized order.
3. Monitor the first few chunks to confirm that high-volume users are selected first.

Rollback:
- Revert the code and redeploy.
- If the backfill is mid-run, reset the trade backfill state before restarting under the old ordering model.

## Open Questions

- Should the dashboard expose the current priority basis for backfill operations, or is this purely operational?
- If ranking query cost becomes significant, do we want a materialized cumulative-volume table or a background summary table in the next iteration?
