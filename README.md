# EV CostCheck — interactive EV charging cost reconciliation

**[Open the live interactive application](https://ev-costcheck.vercel.app/)** · Independently developed synthetic-data portfolio case study · No account or AI credentials required for the core workflow.

**The problem:** Operations staff must understand which EV charging electricity costs are attributable to different sites and responsible parties. Charging sessions, cumulative meter readings, charger-to-site mappings and time-dependent tariffs do not always agree. Treating unsupported records as billable risks inaccurate allocations.

**What it does:** EV CostCheck validates these four sources, computes *candidate variable-energy costs* from defensible evidence, puts ambiguity on HOLD, assigns follow-up investigations, and records named human reviews. It does **not** issue invoices or control charging equipment.

### Try the functional demonstration (90 seconds)

1. **Understand the evidence:** Click **Explain the £3.14 session**. S101 uses 5 kWh × £0.18 and 7 kWh × £0.32, producing £3.14 from the actual meter intervals.
2. **Change the numbers:** Click **Raise Brighton's morning tariff**. The real source-data rate changes; the engine recomputes **£6.94 → £7.39** with a before-and-after breakdown.
3. **Resolve an investigation:** Click **Register an unmapped charger**. A synthetic register correction moves S103 from HOLD to reviewable. After step 2, the candidate total becomes **£7.89**.
4. **Test a safeguard:** Click **Introduce duplicate meter energy**. Both allocations that claim overlapping energy on the same charger move to HOLD; after the earlier changes, the candidate total becomes **£5.89**.
5. **Explore the complete operations workflow:** Use **Source files** to edit/upload CSVs, **Exceptions** to record follow-ups, **Allocations** to review/approve, and **Review history** to export the audit record. Reset to the original synthetic data whenever needed.

The buttons edit the **same actual browser-local source records** as the CSV editor; they do not swap in canned dashboard values. Different inputs lead to different financial outcomes, and source edits invalidate previous approvals.

**Initial synthetic baseline:** 3 reviewable allocations, 6 held records, **£6.94** in unapproved variable-energy candidate costs. None represents a verified supplier bill.

**Further evidence:** [Current release assessment](docs/RELEASE_STATUS_CURRENT.md) · [Interactive QA journey](docs/INTERACTIVE_DEMO_QA.md) · [Claude findings and fixes](docs/CLAUDE_FINDINGS_DISPOSITION_2026-11-01.md).

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

## Deployment and verification

The current **production application** is [EV CostCheck](https://ev-costcheck.vercel.app/), deployed from the GitHub `main` branch through Vercel. The core project is static JavaScript plus one optional serverless AI function; it requires no database, paid API or build step. GitHub Actions validates the Node tests and a real-origin Chromium workflow under the same development security headers configured in `vercel.json`. See [current release status](docs/RELEASE_STATUS_CURRENT.md) for the exact production commit and release test run.

All application records stay in each viewer's browser unless they intentionally invoke the optional AI endpoint. Never commit `.env` files.

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

The project is not affiliated with ARC IT Recruitment or its anonymous client. The independently built demonstration uses fictional sites and records, not client data.

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

The follow-up audit corrected an asynchronous edit/reconciliation race, rejected empty charger IDs, keyed optional AI advice on unique exception IDs, and prevented late AI suggestions from surfacing after source edits. See `docs/ADVERSARIAL_ENGINEERING_REVIEW_2026-11-01.md` for reproducible evidence. At that point external reviews were pending; an **independent Claude Code review subsequently occurred** and its findings were assessed and fixed as documented below. No completed Cursor Agent audit is claimed.

## Independent Claude review and controls update (1 Nov 2026)

The user ran an independent read-only Claude Code adversarial review in Cursor and supplied its report. Reproduced findings and remediation are logged in `docs/CLAUDE_FINDINGS_DISPOSITION_2026-11-01.md`.

- Same-charger, overlapping **positive cumulative Wh** meter ranges across otherwise valid sessions are held **on both records** to prevent double-counting. This prototype assumes a single cumulative meter register per charger and does not model meter resets or individual connector meters; additional meter identity data would be required for those cases.
- Named approvals now snapshot candidate amount (`allocated_gbp`), metered energy, charger/site, allocation party and calculation scope, not merely the source hash. Existing older audit entries cannot be backfilled and must be treated as legacy.
- Exported audit JSON contains the **current** source dataset for verifying the current reconciliation fingerprint. It cannot reconstruct historical source datasets after edits. Local storage remains mutable, so do not mistake this for independent proof or a regulated audit ledger.
- Unresolved case ownership, investigation status and notes persist through unrelated source edits and reruns. Duplicate exceptions have distinct case identities; changes in the failure reason intentionally open a fresh investigation case.
- The local test server now mirrors Vercel security headers for real-origin browser tests. Optional AI remains disabled unless configured, and never authorises costs.

## Interactive guided demo — not simulated output

A first-time visitor can use three **real source-data interventions** on the Overview page. The UI changes the same local CSV data arrays that the full Source files editor uses, invokes the deterministic `reconcile()` engine, then compares genuine before/after results. Results and comparisons persist locally after reload. Nothing merely swaps displayed text. The scenarios can be combined, or the sample can be reset (with a warning that resetting discards local review and investigation notes).

- **Raise the Brighton morning tariff:** £0.18 → £0.21/kWh. From the unmodified baseline: £6.94 → **£7.39**, three reviewable/six held. S100 changes £1.80 → £2.10 and S101 £3.14 → £3.29.
- **Register CH-MISSING:** Add an explicitly fictional mapping to WARWICK-DEPOT/Fleet. On its own: three → **four** reviewable, six → **five** held, candidate total £6.94 → **£7.44**. This is a hypothetical evidence correction, not an assertion that the missing charger truly belongs at Warwick.
- **Introduce duplicate cumulative meter evidence:** Create `DEMO-DUP-01` with S102's same charger and meter range. On its own: three → **two** reviewable, six → **eight** held, candidate total £6.94 → **£4.94**. Both conflicting sessions are placed on hold, not merely the new duplicate.

Different scenario sequences produce different totals, as expected. Editing any CSV cell directly also produces a genuine before/after comparison on the next successful reconciliation; an unchanged re-run does not pretend a change occurred. If a scenario has already been applied or the relevant sample data was removed, the app explains why it cannot be applied again instead of fabricating an outcome.

Each reviewable allocation now has an **Explain cost** action showing its actual contiguous cumulative Wh meter intervals, the configured rate per interval and the *unrounded* GBP contribution at nine decimal places, followed by the session's once-rounded penny amount. For example, S101 = 5 kWh × £0.18 + 7 kWh × £0.32 = £3.14. The extra breakdown fields are *derived*, not new input evidence; they do not relax any HOLD conditions. The tool still does not verify contractual electricity rates, measure site import, perform billing, or authenticate reviewers.

Run `npm test` (including `tests/interactive-scenarios.test.mjs`) and GitHub Actions real-origin Chromium test (which exercises scenario buttons, comparison, explanation, reload and reset). A successful static build alone is not an acceptable release gate.
