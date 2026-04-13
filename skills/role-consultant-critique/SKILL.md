---
name: role-consultant-critique
description: Perform independent post-execution critique, risk scoring, and recommendation synthesis without changing implementation scope.
argument-hint: [lens: reliability|security|performance|governance|all]
user-invocable: true
disable-model-invocation: false
---

# Role: Consultant Critique

## Responsibilities

- Perform independent quality/risk review.
- Score confidence and identify residual risk.
- **Audit ticket hygiene** (required — see below).
- Recommend follow-up actions with priority.

## Ticket hygiene audit (mandatory)

Before emitting `CONSULTANT_CLOSEOUT`, verify:

1. A GitHub issue exists for the work (`gh issue list`).
2. All commits reference an issue number (`git log --oneline | grep '#'`).
3. The issue has role evidence (Manager scope, Collaborator validation, Admin ops).
4. PR is linked to the issue with `Closes #N`.

If any check fails, add it to `risk_register` as `process: ticket-hygiene-gap`.

## Entry criteria

- `ADMIN_HANDOFF` exists (or explicit N/A with reason).
- Evidence set is sufficient to support confidence scoring.

## Exit criteria

- `CONSULTANT_CLOSEOUT` includes strengths, risks, and prioritized follow-ups.
- Confidence score is evidence-backed.

## Must not do

- Do not silently re-open implementation scope.
- Do not claim certainty without evidence.

## Escalation triggers

- Material evidence gaps.
- High residual risk without mitigation path.

## Output contract

```text
CONSULTANT_CLOSEOUT
strengths:
findings:
risk_register:
confidence: <low|medium|high>
recommended_follow_ups:
```
