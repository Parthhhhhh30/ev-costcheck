# EV CostCheck — current production release status

**Release date:** 1 November 2026
**Portfolio URL:** https://ev-costcheck.vercel.app/
**GitHub repository:** https://github.com/Parthhhhhh30/ev-costcheck (private at release)
**Production branch:** main
**Production commit:** `d8c4c44a7b88a41b96b9676832d951f09f33d690`
**Production Vercel deployment:** `dpl_DrSxo3nEHi4DM5DbSLRwJ2DJQ4kN` — READY
**Production alias:** `ev-costcheck.vercel.app` — assigned to that exact deployment
**Deployment protection:** Vercel Authentication disabled; password protection disabled in project configuration. This was checked through Vercel project metadata. Direct unauthenticated browser/HTTP fetch from this environment was not available; do not claim it was performed.
**Passing production CI:** https://github.com/Parthhhhhh30/ev-costcheck/actions/runs/41348732017 — SUCCESS on exact commit above.
**Automated scope:** 38 Node tests and real-origin Chromium browser workflow covering synthetic fixture load, cost explanation, actual tariff/mapping/duplicate changes, before/after outcomes, browser reload, reset, review/approval invalidation, downloads and narrow mobile layout.
**User acceptance:** User confirmed the interactive Vercel preview scenarios worked before merging; production alias points to the merged tested code.
**Pull requests:** #1 audited financial/approval fixes MERGED; #2 interactive guided demo MERGED.

## What is actually demonstrated

A user acting as an operations coordinator works with synthetic session records, charger-to-site mappings, interval cumulative Wh evidence and time-dependent tariffs. The browser-local deterministic engine returns reviewable candidate variable-energy costs or holds with human investigation; a reviewer can record approval/rejection and export decision history. User changes to source records trigger re-reconciliation and invalidate earlier reviews. A current data snapshot and decision amount are included in audit export.

**Synthetic baseline:** 3 reviewable, 6 held, £6.94 candidate energy costs; no billing or payment.

**Deliberate limitations:** No commercial data, customer adoption, financial savings, physical EV control, supplier bill proof, site import accounting, VAT, standing charges, charger losses, PV/battery attribution, independently authenticated reviewers, append-only audit or multi-user database. Browser localStorage can be changed by the visitor. Meter overlap detection assumes one cumulative meter register per charger. Optional AI advice is not used in cost calculations and must not be enabled publicly without identity, rate limiting, privacy and spending controls.

## Release decision

The finished **portfolio demonstration** passes the specified synthetic-data functional acceptance gate. It is not a production financial accounting platform or evidence of real-world deployment by an employer. A recruiter can open the portfolio URL without a Vercel account according to project protection settings, but the source repository is currently **private** and its GitHub link will not be accessible to a recruiter without permissions.

Previous document `docs/RELEASE_STATUS_2026-11-01.md` remains a **historical pre-release snapshot**; its old statements about "not deployed" and "26 tests" are superseded by this dated production record. Future engineering changes require matching production commit, fresh GitHub CI and Vercel checks.
