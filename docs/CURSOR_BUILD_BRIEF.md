# Cursor — remediation and independent real-origin verification

**Not executed yet.** This is an implementation handoff for Cursor after Claude's adversarial review.

Read `docs/CLAUDE_REVIEW_BRIEF.md`, the resulting dated Claude findings, `docs/RELEASE_STATUS_2026-11-01.md` and the source. Do not change code before documenting an evidence-backed defect or essential release failure. Work in a feature branch, not `main`.

Implementation standards: write a reproducing test for each verified defect first; fix the smallest surface; keep deterministic financial calculations separated from optional AI; protect audit/approval invalidation; preserve 3 ready, 6 held, £6.94 synthetic baseline; do not invent tariff allocations across unknown boundaries. Never represent portfolio work as commercial implementation. Add no unrelated charts, agents, databases or solar modules for show.

Verification:
- `npm test` must pass with additional regression coverage.
- Run `npm run serve`, then `BASE_URL=http://127.0.0.1:4173 python tests/browser_live.py` with Python Playwright Chromium installed. This is different from the in-memory `tests/browser_smoke.py` test.
- Run a real mobile-width browser test, inspect console/page errors, stale approvals after reload, CSV downloads, permitted input editing, held-record investigation and no-AI offline operation.
- If deploying to a Vercel preview, rerun the real-origin test with the actual preview URL and inspect deployment logs.
- Document changes, files and commands, failed/passed tests, known limitations and the exact commit SHA. Do not claim a Claude/Cursor pass if it was not actually performed.
