## 1. Data Contract

- [x] 1.1 Extend the dashboard user query in `src/db.ts` to return each user's cumulative fee total from stored fee snapshots.
- [x] 1.2 Update `XtUserRecord` in `src/types.ts` and the `/admin/users` response shape in `src/http.ts` so the new fee fields are exposed consistently.

## 2. Dashboard UI

- [x] 2.1 Add a cumulative fee column to the main user table in `src/dashboard.ts`.
- [x] 2.2 Render the new fee value with the existing numeric formatting and keep the table responsive on smaller screens.

## 3. Verification

- [x] 3.1 Update or add tests for the data store and dashboard payload so the fee total is present and correctly aggregated.
- [x] 3.2 Update dashboard rendering tests and confirm the existing balance, referral code, and trade volume behavior still passes.
