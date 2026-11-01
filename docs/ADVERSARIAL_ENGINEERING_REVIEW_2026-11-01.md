# EV CostCheck — release-gate adversarial engineering review

**Date:** 1 November 2026. **Reviewer:** ChatGPT-assisted engineering audit; **not** an independent Claude or Cursor review. **Scope:** RC1 source files and browser workflows; synthetic data, not production billing validation.

## Reproduced and remediated defects

| Severity | Source | Reproduction and failure | Correction and test |
| --- | --- | --- | --- |
| HIGH | `assets/app.mjs` `run()` / `markDirty()` | Start a digest-based reconciliation, edit a tariff before the asynchronous hash resolves. Old implementation could publish a result from mutable data under the newer source revision, clearing the source-edit hold. | Clone the input at run start, capture revision and run token; abort publication when either changes. Tests: `tests/browser_smoke.py` deferred digest; `tests/browser_live.py` native-WebCrypto deferred digest on real origin. |
| HIGH | `assets/engine.mjs` `reconcile()` | A session with `charger_id=''` could be priced if `chargers.csv` contained a mapping for the empty ID. | Explicitly HOLD sessions with missing charger IDs. `tests/engine.test.mjs` regression. |
| MEDIUM | `api/brief.js`, `assets/app.mjs` | Duplicate held session IDs (present in the demonstration data) caused optional AI briefing to fail, despite distinct exception IDs already being generated. | Key optional, advisory AI requests and response verification on unique `exception_id` rather than `session_id`. Test simulated provider acceptance and rejection of a foreign exception ID. |
| MEDIUM | `assets/app.mjs` AI request | AI response initiated on one source revision could arrive after an edit and still display advice for an outdated run. | Require source revision, run token and current-run validation before displaying response. |
| MEDIUM | `.github/workflows/ci.yml`, `dev-server.mjs` | Previously, Chromium GitHub CI failed because local `.mjs` assets were not served with a JavaScript MIME type; preview worked. | MIME corrected and CI module-content-type preflight added in commit `98da579`. Previous GitHub CI confirmed green. |

## Evaluated but not silently "fixed"

- **Audit history is not tamper-proof:** browser-local mutable storage; human decision evidence is a demonstration only. True financial controls would need authenticated identities, append-only server audit and access review.
- **Configured tariffs are not contractual real energy bills:** no site-import meters, losses, PV/battery allocation, settlement, VAT or supplier tariff authentication. Retain strong warning: no invoices or charges.
- **Concurrency across devices/tabs:** this prototype has no shared server or cross-tab locking. The fix addresses asynchronous edits **within one running UI** only.
- **Session overlap:** a charger may have multiple connectors; do not reject simultaneous sessions without charger connector topology and an explicit exclusivity rule.
- **Data retention:** browser storage can be cleared. Download audit JSON for demonstration records and do not use real customer data.
- **Optional AI endpoint:** disabled without credentials. Even with an access phrase it does not have authentication, quotas or dedicated rate limiting; do not enable for an open public demo.

## Evidence and release constraints

Run locally `npm test` and `python tests/browser_smoke.py`. GitHub Actions must additionally pass `tests/browser_live.py` on an actual HTTP origin, including race regression. The Vercel preview must be built from the **exact commit** whose CI passed. A Vercel `READY` state alone does not prove business correctness. An independent Claude review and Cursor remediation pass remain unperformed and must never be described as complete.
