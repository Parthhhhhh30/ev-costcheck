# EV CostCheck — working operations application

**Independent portfolio exercise** for an infrastructure Project Coordinator vacancy. This is a functioning reconciliation workflow, not a billing platform and not a demonstration of commercial EV or solar installation experience.

## What it does

- Upload or edit four CSV sources: charging sessions, interval-level meter readings, charger-to-property mapping, and time-dependent electricity tariffs.
- Reconcile per-session meter consumption. Reject contradictory, missing, duplicate, or ambiguous evidence.
- Compute cost using integer Wh and decimal tariff arithmetic. Round once per session, HALF_UP to 2 decimal places.
- Detect unknown chargers, conflicting rates, gaps/overlaps in interval readings, conflicting cumulative readings, and orphan intervals.
- Provide an action register for held records, with owner, due date, status and investigation notes.
- Enable human approve/reject decisions only on reviewable candidates; require reviewer name and rationale.
- Block stale allocation views and exports immediately when **any** input dataset changes; invalidate prior approvals until reconciliation is rerun **and a new named review is recorded**, even if source values are later reverted. Store the audit evidence fingerprint and history.
- Export reconciled allocations, exception/action list, audit JSON and reviewer briefing.
- Optional AI follow-up suggestions through server-side `/api/brief` (requires explicit credentials and setup). Deterministic workflow always works without AI.

## Run on Mac/Windows/Linux

Node.js >= 20. No npm dependencies or build step.

```bash
npm run serve
```

Open `http://localhost:4173` and use the supplied synthetic sample dataset. In the source-file editor, change the first Brighton tariff rate from `0.18` to `0.21`, rerun and see the candidate amount change; any prior review becomes stale.

Run the independent tests:

```bash
npm test
```

### Expected synthetic run

3 allocations ready; 6 held; £6.94 variable-energy candidate total. All amounts are pending human review and cannot be used to bill anyone.

### Source contracts

- `sessions.csv`: `session_id,charger_id,start_utc,end_utc,meter_start_wh,meter_end_wh`
- `meter_intervals.csv`: `session_id,start_utc,end_utc,meter_start_wh,meter_end_wh`
- `chargers.csv`: `charger_id,site_id,allocation_party`
- `tariffs.csv`: `site_id,start_utc,end_utc,gbp_per_kwh`

Timestamps must be ISO 8601 with `Z` or explicit UTC offset. Meter energy is cumulative whole Wh. Tariffs are in GBP/kWh with up to 6 decimal places. A metering interval crossing a rate change is **held**, not allocated by duration; precise allocation would require sufficiently granular meter evidence. Records are stored in the current browser's localStorage, so this is not multi-user cloud storage.

## Optional AI assistance on Vercel

The optional `/api/brief` endpoint is disabled until both server-only environment variables are set in Vercel:

- `OPENAI_API_KEY` — provider API key, never stored in client code.
- `BRIEF_ACCESS_CODE` — a private random access phrase **at least 16 characters**.
- `OPENAI_MODEL` (optional) — defaults to `gpt-4.1-mini`.

The user initiates the model call and types the access phrase. Only structured exception reasons and session IDs are sent. The model can suggest **next checks only**, cannot calculate or approve amounts. The server validates source IDs and restrictive output constraints; it fails closed if the model produces unverifiable content.

**Security limitation:** This access-code gate is suitable only for a low-volume private portfolio demo. Public multi-user AI requires authentication, rate limits, usage caps and a privacy review. Do not enable the AI endpoint on an openly shared deployment without those safeguards.

## Deployment

This folder is ready for a **static Vercel project**, with one optional Node.js serverless function (`api/brief.js`). No database, build pipeline or paid service is required for the core workflow. Upload/push to a new GitHub repository, import it in Vercel, select project root, and deploy. All browser data remains local to the viewer. Never commit `.env` files.

## Strict limitations

- Synthetic sample data only; no verified commercial outcome or processing-time saving.
- Cost scope: metered **chargepoint output energy** multiplied by a **configured nominal tariff** for a property. This is not necessarily the property's actual grid-procurement cost.
- Excludes site import meters, meter calibration, losses, contractual pass-through conditions, VAT, standing charges, CPO billing, solar/battery energy attribution, financial posting and site equipment control.
- Costs require legal/finance/technical review before any real allocation or invoice.
- `docs/reference_python_engine.py` is the independently executed earlier CLI prototype. The browser engine uses a stricter input contract (integer Wh, tariff precision <= 6 decimals). `npm test` cross-checks known sample results.
- The app does not automatically identify root causes of faulty charging hardware.
- Reconciliation is browser-local, with no independent backend attestation, login, multi-user concurrency control or tamper-proof audit storage. The source revision prevents unintentional approval revival; it is not an anti-fraud control.
- Exception action IDs are unique per held row; status in the CSV export is the financial HOLD state and `investigation_status` tracks the follow-up separately.

## Evidence and development provenance

The original Python prototype passed 16 tests on the user's Mac. This browser version was implemented and tested with ChatGPT assistance. **Claude and Cursor were not run through this chat's integrations**; `docs/CLAUDE_REVIEW_BRIEF.md` and `docs/CURSOR_BUILD_BRIEF.md` provide handoff-ready critical review and implementation tasks, not claims that those tools completed work.

The project is not affiliated with ARC IT Recruitment or its anonymous client.

## Recovery hotfix (1 Nov 2026)

A source edit now immediately hides stale candidate allocations and exceptions, marks former review decisions stale, prevents derived CSV/brief exports, and blocks further review until reconciliation succeeds. Audit history export stays available and reports `source_edits_pending: true` without representing the outdated source hash as current. Added two regression tests. The original recovered V1 is retained separately.

## Additional safety audit (1 Nov 2026)

Source revisions are monotonically incremented for every source edit. Reviews must match both source fingerprint and source revision, so changing a value and later reverting it never revives a previous approval. Held records now have unique exception IDs; action export retains both financial HOLD and investigation state. Rejects normalised invalid calendar dates and impossible timezone offsets. Browser-local actions are included in the audit JSON. The optional AI API enforces a parsed-body size limit even without a reliable HTTP Content-Length header.

## Verification on a real origin

The code includes two browser tests with different claims:

- `python tests/browser_smoke.py` runs the real UI/engine in Chromium on an isolated in-memory page with mocked fetch, localStorage and browser digest. This works where localhost navigation is blocked and is a **DOM workflow test only**.
- `BASE_URL=http://127.0.0.1:4173 python tests/browser_live.py` runs the full Chromium user workflow against the actual local HTTP server, with native SHA-256, page reload and real downloads. A GitHub Actions workflow runs this on push/PR. Execute against the Vercel preview by setting `BASE_URL` to the actual preview URL; never claim it passed until run against that URL.

Saved source data is rehashed on page startup before reusing prior reconciliation; mismatched stored state is held for fresh reconciliation. The local audit remains editable browser storage, not immutable financial evidence.

## Release-gate engineering audit (1 Nov 2026)

The follow-up audit corrected an asynchronous edit/reconciliation race, rejected empty charger IDs, keyed optional AI advice on unique exception IDs, and prevented late AI suggestions from surfacing after source edits. See `docs/ADVERSARIAL_ENGINEERING_REVIEW_2026-11-01.md` for reproductions, scope limits and evidence standards. The **original synthetic 3 ready / 6 holds / £6.94** remains unchanged. The external Claude and Cursor reviews are **pending**, not credited.

## Independent Claude audit and follow-up (1 Nov 2026)

The user ran an independent read-only Claude Code review and provided the findings. See `docs/CLAUDE_FINDINGS_DISPOSITION_2026-11-01.md` for the severity-ranked disposition. Confirmed fixes:

- Cross-session **positive cumulative Wh meter range** overlaps on the same charger now hold **both** affected candidates to prevent double counting; adjacent ranges are allowed. Assumes one cumulative register per charger; meter resets and connector-specific meters are not supported.
- Human decisions now snapshot candidate GBP, kWh, site, charger, allocation party, and scope. Older browser decisions cannot be backfilled.
- The audit export includes current source inputs for reproducibility, not historical versions from before edits. Browser storage remains mutable and unsuitable for financial attestation.
- Outstanding investigations preserve owners, statuses, dates and notes across unrelated source edits using stable case keys; different reasons constitute new cases.
- Local real-origin browser CI now receives the same security headers configured for Vercel. AI null input validation fails closed.

Do not enable the optional AI endpoint for an open public demo without authentication, rate limits and cost limits.
