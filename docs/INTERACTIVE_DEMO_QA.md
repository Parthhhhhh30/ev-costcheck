# EV CostCheck interactive demo — release QA

## Intended first-visit journey

1. Understand the fictional Brighton/Warwick charging-cost reconciliation mission.
2. Click **Explain the £3.14 session**; inspect S101's two intervals and rate arithmetic. Confirm no amount is invoiced.
3. Click **Raise Brighton's morning tariff**; the actual tariff CSV row changes; candidate amount changes from £6.94 to £7.39, and S101 becomes £3.29.
4. Click **Register an unmapped charger**; new fictional row is added to `chargers`, and S103 changes from held to reviewable. As actions accumulate, candidate total is £7.89.
5. Click **Introduce duplicate meter energy**; a new session and interval are added to the actual data. Both this and S102 move to HOLD. With the previous two changes, candidate total becomes £5.89 and counts are 3 reviewable / 7 held.
6. Use **Reset to original sample**, confirm loss of current local work, and verify 3 ready / 6 held / £6.94 again. The full Source files editor remains available for arbitrary CSV modifications.

## Security and control constraints

- All actions are against browser-local synthetic data, not a remote device or payment provider.
- Changed source input invalidates old approvals. Previous decision records remain historical but stale.
- All values shown in cost explanations derive from accepted intervals and tariffs processed by the deterministic engine. Failing records have no explainable allocation.
- No risk of repeated button clicks silently changing unchanged data: scenario preconditions are checked.
- No AI credentials are required; the optional AI endpoint remains inactive without server secrets.
- Comparison snapshots contain summary data and a capped list of changed session values, not extra personal information.

## Test evidence policy

`npm test` tests both results and precision of cost breakdown. Chromium `tests/browser_live.py` tests the real DOM actions against an HTTP origin and Vercel-style security headers, local-storage reload and downloads. If GitHub CI is red, the feature is blocked. Never claim a local-origin test passed in a container where Chromium navigation is blocked.
