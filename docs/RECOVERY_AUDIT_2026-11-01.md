# EV CostCheck — Source Recovery and Release-Gate Audit

Date: 1 November 2026. Scope: independent portfolio exercise for ARC IT Project Coordinator vacancy reference 303983.

## Provenance and exact recovery

- Recovered original source ZIP, original Python working prototype ZIP, original Git bundle, and screenshot from the user's ChatGPT Library.
- Source ZIP and Python ZIP passed `unzip -t`; original Git bundle passed `git bundle verify` inside a repository.
- Original source and restored Git repository matched file-for-file (excluding `.git`).
- Original Git history: `a3f5641` (build), `90388db` (verified test report).
- Original browser tests: **16/16 passed** in a fresh Node 22 environment.
- Original Python tests: **16/16 passed** in a fresh Python 3.13 environment.
- Synthetic fixture: **3 candidates, 6 held records, £6.94 variable-energy costs pending review**.

## Material defect and recovery patch

Severity HIGH for the portfolio control narrative: after editing an input and before rerunning reconciliation, the original GUI marked data dirty but still showed previously approved cost allocations, still permitted exports of old candidate allocations and exceptions, and presented prior approvals as current in the audit table. The actual save-review path already blocked approvals while dirty; the gaps involved outdated views and derived exports.

This revision:
- Immediately marks all historical reviews stale when inputs are edited.
- Hides previous candidate costs, allocations and held queues while edits are pending.
- Blocks CSV allocation / exception exports and deterministic briefing generation until reconciliation completes.
- Leaves audit history export available but marks `source_edits_pending` and sets `current_run_sha256` to `null` while dirty.
- Adds two focused regression tests. Browser tests now **18/18 passed**. Static JS syntax checks passed.

This is a safety hotfix, not a redesign. All prior calculation fixtures and sample outputs remain unchanged.

## Remaining limitations and blockers

- **Interactive browser E2E not verified.** Playwright Chromium navigation to localhost and local files was denied by this environment with `ERR_BLOCKED_BY_ADMINISTRATOR`. The original chat also reported browser navigation restrictions. The static layout preview was inspected, but cannot substitute for interaction or mobile accessibility testing.
- No independent Claude review and no Cursor build pass have run; the handoff briefs are proposals, not reviews.
- On 1 Nov 2026, GitHub authenticated user `Parthhhhhh30` had no accessible `ev-costcheck` repository (exact repo request returned 404). The connector cannot create new repositories.
- Vercel team listing returned **0** teams, and a search for `ev-costcheck` projects returned **0**. No deployment has been made or live URL verified. An older short-lived SSO request from the previous chat should not be relied on.
- AI briefing endpoint is intentionally optional, disabled without server-side configuration, and unsuitable for unprotected public use without a real identity/rate-limit/budget/privacy layer.
- Financial logic covers only nominal variable chargepoint energy cost, not site grid purchase, solar/battery attribution, losses, contracts, tax, or invoices.
- Audit history is localStorage-based and not tamper-proof, centrally hosted or multi-user. A SHA-256 fingerprint of input data does not authenticate the reviewer or prove independence of approvals.
- The software does not demonstrate real solar asset performance assessment or physical project coordination; do not inflate portfolio claims to imply those capabilities.
- The user must run and understand the code and contribute verification/changes before accurately claiming personal implementation.

## Publication gates

1. Open the patched source folder and manually exercise the full CSV upload-edit-rerun, exception action, review, stale-state and export flows in an unrestricted browser; capture results.
2. Conduct adversarial code/financial validation (Claude when user has a real Claude environment); implement only substantiated findings, ideally with Cursor, and rerun tests.
3. Create an empty `Parthhhhhh30/ev-costcheck` GitHub repository and push the recovered/new history using the Git bundle, or provide an authenticated existing repository with proper permissions.
4. Restore Vercel account authorisation where needed, connect the intended GitHub repo, deploy preview, verify network responses, browser interactions, mobile behaviour and logs.
5. **Do not enable the AI endpoint publicly** until security controls exist. The offline deterministic workflow is complete without it.
6. Publish only verified claims in CV/portfolio: synthetic example, controlled reconciliation process, developer tool provenance, limitations. Never claim billable financial accuracy or external customer adoption.

Release status: **SOURCE RECOVERED; AUTOMATED TESTS PASS; APPLICATION NOT YET LIVE-RELEASE-READY.**
