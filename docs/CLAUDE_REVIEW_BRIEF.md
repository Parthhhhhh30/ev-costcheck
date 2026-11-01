# Claude — independent engineering and financial-control review request

**Not executed yet.** This file is a handoff, not evidence that Claude reviewed the project.

Review the codebase in this repository as an independent sceptical reviewer, not as a feature-builder. Do not conflate synthetic fixtures with real financial accuracy. Run `npm test`, read `docs/ROLE_FIT.md`, `docs/RELEASE_STATUS_2026-11-01.md`, `assets/engine.mjs`, `assets/app.mjs`, and `api/brief.js`.

Audit and reproduce failures, prioritised by severity:
1. Meter and tariff interval boundaries, timezone offsets, rounding modes, duplicate IDs, invalid timestamps, empty/missing sources, mapping errors, metering contradictions, unhandled failures and realistic edge cases.
2. Approval/reconciliation integrity: any source edit invalidates old approvals permanently; reverting a source value may not revive a previous review; reloading with modified cached source JSON cannot reuse stale calculations; held records can never be approved.
3. CSV import/export injection, duplicate exception action identity, audit provenance, localStorage corruption or loss, data limits and browser state integrity.
4. Optional AI endpoint: missing secrets fail closed, prompt injection, ID whitelists, oversized bodies, content validation, unsafe public-access risks. Keep AI advisory only and never let it calculate or approve costs.
5. Financial truth: chargepoint-output energy vs property import/grid costs, energy losses, tariff contracts, VAT, site PV/battery allocation, no billing system and no physical control.
6. Role relevance vs actual ARC IT requirements; honest claims about a synthetic, independently built portfolio demonstration.

Produce a severity-ranked table with file:line evidence, failing test input/reproduction, expected vs actual, and the smallest justified code/test remediation. Note which issues are only production-hardening limitations rather than genuine defects in this demonstration. **Do not modify the code.** Deliver findings to Cursor only after review.
