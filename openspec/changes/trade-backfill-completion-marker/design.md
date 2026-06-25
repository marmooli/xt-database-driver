## Context

The historical trade backfill already tracks progress by user and date, but it can still keep reselecting users that are already complete for the current historical window. Those extra selections do not produce data and only waste queue turns and database reads.

We want a small state marker that tells us, for each user, up to which Germany-local date the trade backfill is known to be complete.

## Goals / Non-Goals

**Goals:**
- Skip users that are already complete through the current target date.
- Persist a date-scoped completion marker per user in D1.
- Preserve the existing trade snapshot semantics and priority ordering.

**Non-Goals:**
- Do not change daily trade sync.
- Do not change how missing trade days are fetched or stored.
- Do not introduce a separate completion table unless the marker proves insufficient later.

## Decisions

1. **Store the marker on `xt_users`**

   Add a nullable `trade_backfill_completed_through_date` column to the user catalog. This keeps the state with the user it belongs to and avoids a new table for a single marker.

   Alternatives considered:
   - Dedicated completion table. Rejected because it adds a join and more schema surface for one field.
   - Deriving completion every time from snapshot counts. Rejected because that preserves the repeated scans we are trying to remove.

2. **Make the marker date-scoped**

   The marker should mean "complete through this Germany-local date", not "done forever". That lets the same user become eligible again when the current target date advances.

   Alternatives considered:
   - Permanent done flag. Rejected because the historical target window moves as the job continues.

3. **Only write the marker when a user reaches the current target date**

   The marker should be written when the backfill chunk reaches the current end date and finds no missing snapshots left for that user in the current window.

   Alternatives considered:
   - Update the marker on every chunk. Rejected because chunk boundaries do not equal completion.

4. **Skip completed users before selecting the next user**

   The next-user lookup should ignore users whose completion marker already covers the current target date. That prevents the backfill from churning on users that cannot produce new rows.

## Risks / Trade-offs

- [The marker can become stale when the target date advances] -> Mitigate by comparing the marker to the current target date rather than treating it as permanent.
- [The query gains one more filter] -> Mitigate with a nullable date column and keep the query indexed and simple.
- [A marker written too early would hide missing rows] -> Mitigate by writing it only after a user reaches the current target date.
- [Rollback may leave the new column unused] -> Mitigate by keeping the marker nullable and non-destructive.

## Migration Plan

1. Add the nullable completion-date column to `xt_users`.
2. Update trade backfill selection and completion writes to use the marker.
3. Deploy the change and restart the running backfill if needed.
4. Verify that already-complete users stop being reselected for the same target date.

Rollback:
- Revert the code.
- Keep the nullable column in place; it is safe to ignore.

## Open Questions

- Should the marker name be `trade_backfill_completed_through_date` or shortened to `trade_backfill_done_through`?
- Do we want to expose the marker in the dashboard later for operational debugging, or keep it backend-only?
