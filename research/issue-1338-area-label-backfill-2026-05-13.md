# Issue #1338 — Closed-issue area-label janitorial backfill
Date: 2026-05-13

## Summary Table
| Item | Result |
|---|---|
| Closed issues scanned | 872 |
| Rule 6 violators before | 141 |
| Rule 6 violators after | 0 |
| Scope touched | Closed issues only (label metadata only) |

## Method
1. Pulled closed issues via GitHub CLI JSON export.
2. Evaluated Rule 6 using `scripts/global/label-rules.js`.
3. Chose one canonical `area:` label per violating issue using deterministic precedence and keyword inference.
4. Applied label edits with `gh issue edit` (remove extra `area:*`, add missing canonical `area:*`).
5. Re-ran the Rule 6 audit across all closed issues.

## Deterministic area resolution policy
- Multi-area issues: precedence order
  - `area:governance` > `area:scripts` > `area:infra` > `area:dashboard` > `area:hooks` > `area:agents` > `area:instructions` > `area:skills` > `area:knowledge`
- Missing-area issues: infer from title/body keyword families (dashboard/scripts/hooks/infra/knowledge/agents/instructions/skills), fallback `area:governance`.

## Verification output
- Before remediation: `rule6 violators=141`
- After remediation: `rule6 violations=0`

## Last-updated
2026-05-13T00:00:00Z

## Actionable Next Steps
1. Keep Rule 6 gate active for closed-issue scans to prevent regression.
2. Consider adding a periodic janitor script to auto-open a drift ticket if Rule 6 closed-issue count > 0.

Signed-by: Nova Mason
Team&Model: copilot:gpt-5.3-codex@github
Role: consultant