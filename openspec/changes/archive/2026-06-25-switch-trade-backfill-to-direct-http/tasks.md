## 1. Trade Source Switch

- [x] 1.1 Add a direct HTTP trade source that calls the signed proxy route for `get_user_deposit_trading_data`.
- [x] 1.2 Switch the shared trade source factory so daily trade sync and trade backfill use the direct HTTP source.
- [x] 1.3 Keep the existing trade response parser and stored snapshot semantics unchanged.

## 2. Tests and Docs

- [x] 2.1 Add tests that prove the direct HTTP trade source sends the expected request and parses the expected response.
- [x] 2.2 Update the existing trade-source tests to reflect the new default transport.
- [x] 2.3 Update docs so the active trade transport is described as the signed HTTP proxy route rather than MCP.

## 3. Verification and Rollout

- [x] 3.1 Run typecheck and unit tests after the source switch.
- [x] 3.2 Deploy the worker and verify the live trade sync/backfill path uses the HTTP proxy route.
