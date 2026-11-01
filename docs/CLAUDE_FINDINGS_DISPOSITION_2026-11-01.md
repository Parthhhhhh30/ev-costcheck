# EV CostCheck — Claude findings and remediation (1 November 2026)

The user independently ran Claude Code in Cursor in **read-only mode**, then provided its report. This response documents verified corrections rather than claiming commercial financial certification.

| Finding | Disposition |
| --- | --- |
| M1: Same charger cumulative Wh allocated twice across two different sessions | Confirmed with red regression. Engine now places **both** individually valid conflicting sessions on HOLD when positive cumulative meter ranges overlap, rather than choosing a winning record. Adjacent disjoint ranges remain eligible. |
| M2: Decisions omit the approved amount and context | Confirmed. New decisions snapshot `allocated_gbp`, `metered_kwh`, charger, site, party and scope with reviewer/time/revision/hash. Audit export includes **current** source inputs for current-hash reproduction. Prior historical source datasets are NOT recoverable and prior decision rows are NOT backfilled. |
| M3: Source-hash plus positional exception ID discards existing investigations | Confirmed. New source-independent `case_key` combines session ID, charger ID, hold reason and duplicate occurrence; unchanged issues retain owner, notes and status after unrelated edits or held-row reordering. Previous source-based browser entries are migrated when the old held row can be matched. |
| L1: CSP versus local test mismatch | Local dev server now mirrors security headers from `vercel.json`. Removed inline-style attribute. Real-origin Chromium tests must run in GitHub Actions. |
| L2: Null input elements crash advisory AI route | API now sends HTTP 400 for null and non-object array elements; regression test added. |
| L6: Source-table cap notice duplicates | Previous notice is removed before a replacement is rendered. |
| L3: AI advice filter is conservative | Left unchanged because refusal fails closed. The AI pathway is optional and disabled without secrets. |
| L4: Bad tariff row holds affected sessions | Intentionally fail closed. More precise error messaging is an optional enhancement. |
| L5: Zero-energy session produces £0.00 | Accepted as an explicit reviewable zero-energy candidate, not automatic billing. |
| L7: Old release reports and local archives are stale | Current CI and Vercel SHA provide authoritative release status. |

**Truth boundaries:** This is a synthetic local-first demonstration, not real electricity procurement or billing. It models one cumulative meter register per charger; connector-specific meters and resets require explicit new IDs. Browser localStorage is mutable, lacks authenticated reviewer identities and is not an append-only audit. Changes in failure reason create a new case deliberately; indistinguishable duplicate-case ordering remains ambiguous. A current-source audit export does not reconstruct historic source inputs.

**Acceptance gate:** Node regressions, Chromium browser workflow on actual HTTP origin under CSP, and Vercel preview build must all pass on the same commit before merge/promotion. The assistant's local Chrome navigation was blocked by the execution environment; only GitHub CI may establish real-origin evidence. The separate Claude review did not run Playwright.