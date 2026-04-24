# Governance Verification Checklist (2026-04-23)

Date: 2026-04-23

## Summary Table

| Check | Command | Pass Condition | Fail Condition |
|---|---|---|---|
| Ticket schema integrity | `node scripts/global/governance-verify.js` | Exit `0` | Exit `1` with issues |
| Machine-readable audit | `node scripts/global/governance-verify.js --json` | JSON `status=pass` | JSON `status=fail` |
| Repo policy gate | `npm run lint --silent` | 100-line rule passes | Any lint failure |

## Admin/Consultant Evidence Format

Use this block in ticket closeout artifacts:

- `governance_check_run`: `<ISO timestamp>`
- `governance_check_command`: `node scripts/global/governance-verify.js --json`
- `governance_check_result`: `pass|fail`
- `governance_failures`: `<count>`
- `governance_followup`: `<ticket ids or N/A>`

## Detailed Findings

- The harness checks priority presence, closed-ticket normalization, closeout sections,
  and epic closed-with-open-children violations.
- Failures are expected to surface historical drift; this is intentional and actionable.
- Output can be consumed by Admin for gate decision and Consultant for closure critique.

## Actionable Next Steps

1. Run harness before `status:review -> done` on P0/P1 tickets.
2. Open remediation tickets for any reported governance failures.
3. Attach JSON output excerpt to ticket evidence blocks.

Last updated: 2026-04-23
