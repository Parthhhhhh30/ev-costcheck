# EV CostCheck — current release checklist

- [x] Recovered independent Python prototype and original Git ancestry.
- [x] Deterministic reconciliation matches Python synthetic fixture: 3 reviewable, 6 held, £6.94.
- [x] 26 Node tests passed (including optional AI endpoint failure cases).
- [x] Browser DOM smoke test passed in Chromium with mocked fetch/local storage/digest.
- [x] Desktop and mobile DOM screenshots inspected; menu swipe hint added.
- [x] Source edit and revert cannot revive old review approvals.
- [x] Unique held exception IDs; separate financial HOLD from investigation status.
- [x] Optional AI endpoint server-secret protected and disabled without setup.
- [x] Real-origin Chromium test and CI workflow included **but not executed on a real origin yet**.
- [ ] Real-origin `tests/browser_live.py` executed successfully on preview/local HTTP origin.
- [ ] Claude adversarial review actually performed and results recorded.
- [ ] Cursor remediation pass actually performed (or no verified defects found).
- [ ] Repository created and code pushed to GitHub.
- [ ] Vercel preview deployment completed and route/log verification passed.
- [ ] Public publication approved by user after private preview review.

See `docs/RELEASE_STATUS_2026-11-01.md` for the honest release decision and limitations.
