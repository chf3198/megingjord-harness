# HOWTO: No-Code Remediation Lane

Refs #2258 #2268

## Purpose

Use `lane:no-code-remediation` when a ticket requires only issue-thread normalization (labels, artifacts, closeout evidence) and no repository changes.

## Eligibility

- Drift is limited to issue metadata/evidence state.
- Corrective action can be completed without any branch diff.
- Runtime sync checks are `N/A` because deployed runtime files are untouched.

## Exclusions

- Any edit under repository-tracked paths (`instructions/`, `scripts/`, `tests/`, docs, workflows, configs).
- Any gate remediation that requires a commit or PR diff.
- Any ambiguity about whether root cause is issue-only.

When excluded, Manager reclassifies to `lane:code-change` and executes full baton.

## Required Evidence Blocks

Manager artifact must include:
- `lane: lane:no-code-remediation`
- explicit eligibility rationale
- exact issue-only actions to run

Consultant closeout must include:
- verification that each issue-only action completed
- `verdict`, `rubric_rating`, and `mid_flight_flaws` accounting

Use explicit reduced markers:
- `COLLABORATOR_HANDOFF: N/A - no-code remediation lane`
- `ADMIN_HANDOFF: N/A - no-code remediation lane`

## Common False Positives

- Stale advisory label appears on a merged closed ticket.
  - Valid no-code fix: remove stale advisory label after confirming merge evidence.
- Missing merge evidence with uncertain state.
  - Not no-code: escalate to full baton if evidence cannot be proven from issue/PR metadata.
- Validator failure requests file edits.
  - Not no-code: escalate to `lane:code-change`.

## Escalation Rule

If any step requires editing tracked files, stop no-code flow immediately and re-route to full baton with Manager correction comment.
