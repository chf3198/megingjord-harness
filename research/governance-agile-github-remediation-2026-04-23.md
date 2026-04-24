# Governance + Agile + GitHub Remediation Plan (2026-04-23)

Date: 2026-04-23

## Summary Table

| Gap | Web Evidence | Risk | Improvement Lever |
|---|---|---|---|
| Closed epic with open children | Epic terminality is required by governance; issue lifecycle should be explicit | High | Add epic-child terminality gate before closeout |
| Missing closure evidence | Issue closure and PR linkage are explicit GitHub lifecycle controls | High | Enforce closure evidence completeness checks |
| Merge queue check drift | Required queue checks must trigger on `merge_group` | High | Add CI/queue compatibility verifier |
| Stalled `ready` tickets | Workflow resilience calls out ready-state stalls | Medium | Add ready-age SLA monitor + escalation path |

## Detailed Findings (Web-Corroborated)

1. Linked PR keywords only auto-close issues when merged to the default branch.
   Source: https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue

2. Required status checks can be blocked by ambiguous/non-unique job names.
   Source: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches

3. Merge queue required checks must run on `merge_group`; otherwise required checks are not reported for queue merges.
   Source: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue

4. Projects built-in automations can set status to Done when issues close or PRs merge.
   Source: https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-built-in-automations

5. Issue close action supports explicit close reason and should be treated as a lifecycle artifact.
   Source: https://docs.github.com/en/issues/tracking-your-work-with-issues/administering-issues/closing-an-issue

## Reconsidered Improvement Plan

1. Add hard epic gate: epic cannot close if any child ticket is non-terminal.
2. Add closeout contract gate: closed non-epic tickets require GitHub evidence block fields.
3. Add merge-queue readiness gate: required checks include `merge_group` coverage.
4. Add ready-SLA gate: P0/P1 tickets older than 24h in `ready` trigger escalation.

## Actionable Next Steps

1. Implement epic-child integrity remediation + stale close normalization.
2. Backfill missing closeout evidence on historical closed tickets.
3. Extend governance harness with ready-age and queue compatibility checks.
4. Emit weekly governance drift scorecard for Admin/Consultant closeout.

Last updated: 2026-04-23
