# #583 Task: Readability regression-prevention gates

**Type**: task | **Status**: done | **Priority**: P1 | **Lane**: code-change
**Labels**: type:task, status:done, area:governance, area:scripts

**Linked Epic**: #577 | **Blocked by**: #581

## Summary
Add permanent controls so readability/commenting drift cannot silently re-enter main.

## Scope
- Add CI gate thresholds for readability warnings and doc coverage.
- Add pre-commit/pre-push hooks for format + lint quick checks.
- Add contributor guidance for autofix workflow and local validation.
- Add reporting snapshot for weekly drift tracking.

## Acceptance Criteria
- [x] AC1: PRs fail on formatting/readability gate violations.
- [x] AC2: Local hooks block obvious violations before commit.
- [x] AC3: Drift snapshot/report can be generated and compared over time.
- [x] AC4: CONTRIBUTING docs updated with required local commands.

## Verification Gates
- **Collaborator**: controls implemented and documented.
- **Admin**: branch protections/check names validated.
- **Consultant**: prevention posture sufficient to avoid recurrence.

## MANAGER_HANDOFF
Controls must be fast enough for daily use and strict enough to prevent drift.

## Team&Model
- Collaborator: Pending
- Admin: Pending
- Consultant: Pending

## COLLABORATOR_HANDOFF

- CI gate updates added in `.github/workflows/lint.yml` for `format:check` and `lint:readability:ci`.
- Local hook install flow now provisions `pre-commit` and `pre-push` checks via `scripts/install-git-hooks.sh`.
- Drift snapshot command added: `npm run readability:snapshot` -> `logs/readability-drift.jsonl`.

## ADMIN_HANDOFF

- Guardrails verified in local runs: format gate, line-limit lint, readability threshold gate, and snapshot generation.
- Readability threshold pinned to current baseline (389) to block regression while remediation proceeds.

## CONSULTANT_CLOSEOUT

- Prevention posture is active for CI + local workflows.
- Remaining risk is baseline debt volume, addressed by remediation tasks #581 and #582.
