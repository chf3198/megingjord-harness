# Governance & Agile Workflow Hardening Design (2026-04-23)

Date: 2026-04-23

## Summary Table

| Gap | Web Evidence | Design Lever | Expected Effect |
|---|---|---|---|
| Ambiguous required checks | Protected branches require unique status/job names | Required-check contract + unique job-name map | Fewer merge blocks |
| Queue/CI mismatch | Merge queue needs `merge_group` trigger | Add `merge_group` checks to required workflows | Reliable queue merges |
| Stale work item states | Projects built-in automation can set Done on close/merge | Project workflow normalization | Fewer status drifts |
| Baton stalls at ready | Local governance gaps across roles | Baton SLA + escalation rules | Faster ticket flow |

## External Findings

1. Required checks must be uniquely identifiable; duplicated job names can block merges.
   Source: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
2. Merge queue requires CI to trigger on `merge_group` in addition to PR/push.
   Source: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue
3. GitHub Projects can auto-set item status on issue close/PR merge.
   Source: https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-built-in-automations

## Final Improvement Design

1. Governance gate pack:
   - Enforce baton pickup SLA for `status:ready`.
   - Enforce closure evidence contract (PR/merge or approved exception).
2. CI governance pack:
   - Add `merge_group` trigger where required checks are enforced.
   - Normalize required-check naming to unique stable IDs.
3. Project automation pack:
   - Enable built-in status workflows for closed/merged items.
   - Add drift audit cadence and report format.

## Actionable Next Steps

- Implement via tickets #151–#154 created from this design.
- Validate with pre-close governance harness and one full epic pilot.

Last updated: 2026-04-23
