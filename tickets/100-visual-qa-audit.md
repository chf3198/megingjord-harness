# Ticket 100 — Visual QA Audit

Priority: P0 (High)

Summary:
- Address critical Visual QA findings: loading states, API connection errors, contrast/accessibility issues reported in .dashboard/visual-qa.

Acceptance Criteria:
- Fix perpetual "initializing" state with proper timeouts and error handling.
- Improve contrast for Task Router Lanes and issue number text to meet WCAG AA.
- Add retry and backoff for GitHub API calls and expose actionable error to UI.

Next Actions (Immediate):
1. Reproduce the failing states locally using `playwright-report/index.html` and `.dashboard/events.jsonl` traces.
2. Add guarded network timeouts + retry logic to the dashboard GitHub API connector. (IMPLEMENTED: server retry/backoff + client timeout)
3. Create branch `feat/100-visual-qa-fixes` and open a PR with fixes + visual snapshots.

Owner: `implementer` agent (assign to `Cody Builder` / local implementer)

Status: Closed — server retry/backoff and client-side timeout+error UI implemented; see commits.
