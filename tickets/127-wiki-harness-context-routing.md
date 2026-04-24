# Ticket 127 — Wiki Harness Context Routing + Ingest Reminders

Priority: P1 (High)
Type: Task
Area: hooks
Status: done (`closed`)
Parent: #120
Branch: `hook/127-wiki-harness-implementation`

## Manager Scope

Objective:
- Improve Karpathy LLM Wiki operational utilization by adding task-adaptive
  SessionStart wiki context routing and deterministic wiki-ingest reminders.

Acceptance Criteria:
1. SessionStart injects adaptive wiki snippets based on repo signals.
2. Stop hook emits wiki-pending reminder after significant work.
3. PreCompact preserves wiki reminder signal through compaction.
4. Changes remain under lint constraints (≤100 lines/file) and tests pass.

Constraints:
- Keep hooks deterministic and concise.
- No vector/RAG infra addition.
- Preserve existing governance gates.

## MANAGER_HANDOFF

- Status transition: `triage -> ready`
- Ready for collaborator implementation with AC and validation gates defined.

## Collaborator Progress

- Implementing in:
  - hooks/scripts/wiki_router.py
  - hooks/scripts/session_context.py
  - hooks/scripts/stop_checks.py
  - hooks/scripts/stop_reminder.py
  - hooks/scripts/precompact_anchor.py
- Validation gates pending: lint + tests.

## COLLABORATOR_HANDOFF

Completed:
- Added adaptive wiki routing: `hooks/scripts/wiki_router.py`
- Wired SessionStart adaptive context in `session_context.py`
- Added wiki-pending reminder helper in `stop_checks.py`
- Wired reminder output in `stop_reminder.py`
- Preserved wiki reminder in `precompact_anchor.py`

Validation evidence:
- `npm run lint` ✅
- `npm test` ✅ (31/31 passing)

Admin required ops:
- Verify acceptance criteria against changed files
- Verify lint/test output remains clean
- Approve consultant critique

## ADMIN_HANDOFF

See: `research/admin-phase-127-validation.md`

Result:
- All admin gates passed ✅
- Recommended status transition: `testing -> review`

## CONSULTANT_CLOSEOUT

See: `research/consultant-closeout-127.md`

Decision:
- Approved with low risk
- Revalidated on 2026-04-23: `npm run lint` ✅, `npm test` ✅ (31/31 passing)
- Ticket closed

## GitHub Evidence Block

- Issue reference/state: `#127` documented as `done`/`closed`.
- Applied labels: Priority/Type/Area/Parent/Branch captured in artifact.
- Linked PR/merge evidence: N/A in local markdown workflow session.
- Validation evidence summary: hook routing/reminder/precompact changes + lint/test pass evidence.
- Verification timestamp (UTC): `2026-04-24T04:53:24Z`
- Exact commands/check outputs used for closure: `npm run lint` and `npm test` passed in governance remediation reruns.
