---
name: role-collaborator-execution
description: Implement scoped changes and produce validation evidence matching manager-defined gates.
argument-hint: [change-scope: small|medium|large]
user-invocable: true
disable-model-invocation: false
---

# Role: Collaborator Execution

## Responsibilities

- Implement only manager-scoped changes.
- Keep edits minimal and localized.
- Run required validation gates and capture outcomes.
- Update docs/changelog when behavior changes.

## Entry criteria

- Valid `MANAGER_HANDOFF` exists.
- Required gates are defined.

## Exit criteria

- `COLLABORATOR_HANDOFF` includes concrete validation evidence.
- `COLLABORATOR_HANDOFF` explicitly enumerates `admin_required_ops` for the Admin role baton.
- Do not declare the feature complete at Collaborator exit; "all gates pass" means implementation is validated, not released.
- Any scope drift is explicitly flagged for manager re-handoff.

## Ticket baton protocol

1. Write implementation comment: `## 🔧 Collaborator — Validation Evidence`.
2. Transition labels: `status:ready` → `status:in-progress`, confirm `role:collaborator`.
3. On COLLABORATOR_HANDOFF: swap `role:collaborator` → `role:admin`.

## Must not do

- Do not alter scope without manager handoff update.
- Do not perform final release/merge/admin governance decisions.

## Escalation triggers

- Missing gate evidence.
- Ambiguous acceptance criteria.

## Output contract

```text
COLLABORATOR_HANDOFF
files_changed:
behavior_changes:
validation_results:
docs_updates:
admin_required_ops:
open_risks:
```
