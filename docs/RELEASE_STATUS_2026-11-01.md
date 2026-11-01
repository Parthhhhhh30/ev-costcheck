# EV CostCheck — release candidate engineering assessment

Date: 2026-11-01
Status: **PREVIEW-READY SOURCE; PUBLIC RELEASE BLOCKED** (GitHub repo and Vercel authorisation/verified deployment pending)

## Purpose
A local-first, working EV chargepoint variable-energy cost reconciliation demonstration built as an independent portfolio work sample for the ARC IT project-coordination vacancy. It does not claim commercial installation experience, operational adoption, or billing authorisation.

## Independently reproduced checks
- **26/26 Node automated tests passing** (21 reconciliation/input/audit tests and 5 fail-closed optional AI endpoint tests).
- Core sample: **3 reviewable sessions, 6 held records, £6.94 candidate variable-energy total**, with no automatic approvals or invoices.
- Chromium browser **DOM-integration smoke test PASS** using actual HTML/CSS/UI/engine scripts plus mocked fetch/localStorage/crypto digest on `about:blank` because this environment blocks localhost/file navigation.
- Browser scenario tested: sample load, exception owner/status, export action CSV, approve pending session, edit tariff, invalidate outputs, deny export, rerun, revert rate, keep old approval stale, export audit history, resize 390px mobile, verify no uncaught page errors.
- Source updated to verify cached data hash on startup before reusing previous calculations. A real HTTP-origin test including browser reload is provided under `tests/browser_live.py` and GitHub Actions, **but has NOT run in this environment**.
- Desktop/mobile smoke screenshots are present in `docs/browser-*-smoke.png` and are explicitly NOT screenshots of a deployed website.

## Material fixes over recovered V1.1
1. Added source-revision IDs to run and review records: old approvals cannot become valid again after tariff edits are reverted to the previous value.
2. Added unique held-exception identities even when duplicated session IDs produce identical reasons. Investigation actions are now distinguishable per held row.
3. Preserved financial HOLD status separately from investigation progress status in CSV exports.
4. Checked dates against valid calendar days and timezone offsets (not just permissive Date.parse normalisation).
5. Added actual parsed JSON size gate on the optional AI endpoint (header-based length checks were insufficient).
6. Saved exception action data in audit JSON and checked cached source hash on browser reload.
7. Added browser workflow smoke test, separate real-origin browser test and GitHub Actions release checks; mobile navigation swipe hint.

## Known limitations and explicit truth boundaries
- **Not yet deployed**. Neither production nor Vercel preview URL has been tested.
- This environment cannot navigate to `localhost` or `file://` using Chromium; it does not prove a deployed origin works.
- No independent Claude review and no Cursor code pass have actually been executed. The handoff briefs are tasks, not evidence of execution.
- All browser data and decision logs are mutable localStorage. No authentication, tamper-evident audit store, backend database, concurrency or reliable cross-device continuity.
- Cost scope remains metered chargepoint output at configured nominal tariff, not actual site grid-energy cost or legally valid customer billing. Excludes VAT, losses, solar/battery allocation, site grid reconciliation, contracts and invoicing.
- Optional AI is disabled without both server-side environment secrets; do not enable it on a public site without authentication, rate limits and spend caps.
- Large CSVs may stress browser rendering/localStorage; demonstrated on synthetic fixtures, not proven at commercial scale.

## Release gates
- [x] Recovered original Git ancestry retained.
- [x] Correct synthetic baseline outputs.
- [x] Automated unit/security regression tests green.
- [x] Browser DOM smoke test executed.
- [x] Repo workflow for real-origin CI provided.
- [ ] Independent Claude adversarial review executed and findings disposition recorded.
- [ ] Cursor implementation pass conducted where needed, with test evidence.
- [ ] GitHub repository created and release commit uploaded.
- [ ] Vercel preview created with correct source.
- [ ] `tests/browser_live.py` passes on an actual reachable origin.
- [ ] Deployment logs and live routes verified; user confirms intended public visibility.

## Account-level prerequisites
1. User creates an empty repository named `ev-costcheck` in connected GitHub account `Parthhhhhh30` (no README/auto-created commit), then supplies the exact repo URL.
2. User authorises the target Vercel workspace/team for the ChatGPT Vercel connection; current MCP reports zero accessible teams/projects. Any prior single-use authorisation URL is expired.
3. Claude and Cursor are not connected as executable tools in this chat; external review needs to run in those applications or through a newly available supported connector.

No provider API keys, access codes or private tokens should be shared in this chat or committed to Git.
