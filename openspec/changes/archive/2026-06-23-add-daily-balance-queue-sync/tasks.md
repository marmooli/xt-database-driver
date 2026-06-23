## 1. Queue and Scheduled Flow

- [x] 1.1 Add Queue binding and daily balance sync configuration.
- [x] 1.2 Start daily balance sync from the scheduled Worker handler.
- [x] 1.3 Add Queue consumer handling for balance sync chunks.

## 2. Storage and Sync Logic

- [x] 2.1 Add D1 helpers to page UIDs in stable order for daily balance sync.
- [x] 2.2 Add daily balance sync orchestration with D1 state updates.
- [x] 2.3 Preserve the existing manual balance sync endpoint.

## 3. Verification

- [x] 3.1 Add tests for daily start, chunk continuation, completion, and duplicate-day prevention.
- [x] 3.2 Run typecheck and tests.
- [x] 3.3 Create/deploy required Cloudflare Queue resources.
- [x] 3.4 Deploy and verify Worker configuration.
