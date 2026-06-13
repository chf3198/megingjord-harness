# Phase-0 Research: Ticket Governance Drift Sweeper (#2982)

Date: 2026-06-13
Last updated: 2026-06-13T00:00:00Z

## Summary

| AC | Status | Outcome |
|---|---|---|
| AC-R1 | complete | Inventory map produced for scripts/workflows and execution modes |
| AC-R2 | complete | D1-D8 coverage matrix with reuse-vs-build decision per class |
| AC-R3 | complete | Auto-fix-safe vs propose-only classes plus reversibility contract |
| AC-R4 | complete | Zero-cost proof with explicit free/fleet-only residue policy |
| AC-R5 | complete | Unified CLI and audit-log design with lane/no-code and canonical-main fit |

## AC-R1 Tooling Inventory (reuse map)

| Tool surface | Drift classes | Mode |
|---|---|---|
| scripts/global/governance-drift-classifier.js | D4,D5,D8 + terminal/open/epic classes | report,batch |
| scripts/global/ticket-reconcile.js | D2,D4,D5,D8 | report,mutate,batch |
| scripts/global/role-baton-audit.js | D2,D5,D7 | report,batch |
| scripts/global/label-rules.js | D2,D4,D5,D8 | rule-engine,event+batch |
| scripts/global/label-lint-status-cardinality.js | D2,D4,D8 | report,event |
| scripts/global/lint-epic-drift.js | D6,D8 | report,batch |
| scripts/global/lint-ticket-redundancy.js | D1,D7 | report,batch |
| scripts/global/coordinator-label-cleanup.js | D7 | mutate,batch |
| scripts/global/governance-audit.js | D1-D8 aggregate | report,batch |
| .github/workflows/label-lint.yml | D2,D4,D8 | report,event |
| .github/workflows/role-baton-linter.yml | D2,D5,D7 | report,event |
| .github/workflows/goal-drift-lint.yml | D1,D6 | report,event |
| .github/workflows/epic-traceability-lint.yml | D5,D6,D8 | report,event |
| .github/workflows/drift-detection.yml | D1-D8 aggregate | report,scheduled |
| .github/workflows/closeout-lint.yml | terminal hygiene support | report,event |
| .github/workflows/merge-evidence-check.yml | terminal/open evidence support | report,event |

## AC-R2 Coverage Matrix (D1-D8)

| Class | Coverage today | Decision |
|---|---|---|
| D1 unlabeled issue | partial (governance-audit/lint-ticket-redundancy) | build wrapper + propose-only |
| D2 in-progress no role | strong (label-rules + role-baton audits) | reuse |
| D3 bad title format | partial (governance-audit title checks) | build deterministic title normalizer |
| D4 resolution on OPEN | strong (label-rules + drift classifier) | reuse |
| D5 child backlog on active epic | partial (role-baton + epic traceability) | reuse + batch transition helper |
| D6 dormant/deferred no EPIC_REVIEW | partial (lint-epic-drift) | reuse + propose-only workflow |
| D7 stalled cross-team handoff | partial (role-baton/coordinator cleanup) | reuse + propose-only queue |
| D8 phase-gate label on epic | strong (label-rules + epic lint) | reuse |

## AC-R3 Auto-Fix Safety and Reversibility

Auto-fix-safe classes: D4, D5, D8, and deterministic branch of D3 (prefix/bracket strip).
Propose-only classes: D1, D2, D6, D7 and non-deterministic D3 phrasing choices.

Reversibility contract for --fix:
- Dry-run default; apply requires explicit --fix.
- Every mutation emits before/after label/title snapshot with ticket id and timestamp.
- Mutation log is append-only JSONL; rollback command replays inverse patch set.
- Any mixed-confidence ticket is downgraded to propose-only with no write.

## AC-R4 Zero-Cost Proof

Deterministic path requires only gh issue/pr/project JSON + local rule evaluation. This yields zero LLM token usage for D2,D4,D5,D8 and most D3. Residue requiring language judgment (D1 type inference, rare D3 rewrite semantics) routes only to fleet-local, then free-cloud on fleet unavailability. Premium lane is prohibited.

Manual audit baseline (127 open tickets) required premium operator reasoning. Proposed sweeper replaces recurring premium sweeps with scripted batch scans and bounded propose queues, reducing recurring token cost to zero in normal operation.

## AC-R5 Unified CLI + Governance Fit

Proposed command:
- npm run governance:drift-sweep -- --scan
- npm run governance:drift-sweep -- --fix --classes D4,D5,D8
- npm run governance:drift-sweep -- --rollback <run_id>

Audit log schema:
- run_id, started_at, actor, mode(scan|fix), ticket, class, action, before, after, reversible(true|false), rollback_ref.

Governance compatibility:
- lane:no-code-remediation: issue-state mutations only; no tracked-file edits.
- canonical-main policy: command refuses tracked writes and permits only issue API mutations.
- observability: JSON report + JSONL mutation log for consultant verification.

## Actionable Next Steps

1. Implement scripts/global/governance-drift-sweeper.js as wrapper over existing detectors.
2. Add class-gated auto-fix engine for D4,D5,D8 and deterministic D3 only.
3. Add propose queue artifact for D1,D2,D6,D7 with manager/consultant verdict fields.
4. Add tests for scan, fix, rollback, and no-code-remediation safety guards.
5. Run cross-family red-team review and iterate until score >= 93/100.

## Sources

- issue #2982 and #2981 bodies (scope, D1-D8 taxonomy, AC definitions)
- scripts/global/governance-drift-classifier.js
- scripts/global/ticket-reconcile.js
- scripts/global/role-baton-audit.js
- scripts/global/label-rules.js
- scripts/global/governance-audit.js
- docs/howto/no-code-remediation-workflow.md
- instructions/role-baton-routing.instructions.md
