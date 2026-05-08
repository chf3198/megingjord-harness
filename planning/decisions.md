# Decisions Ledger — Epic #1103 / #1105 Synthesis

Admin-curated. Promoted from `positions/` when consensus or stability is reached per `protocol.md` §6.

## Synthesis summary

- **Resolved**: 11 / 11
- **Admin tie-break invoked**: 0 / 11 (0%; below 25% operator-escalation threshold)
- **Emergency halts**: 0
- **Wall-clock cap**: 2026-05-10T23:59:59Z (not reached; consensus reached early)
- **Final state**: SYNTHESIS_COMPLETE — ready for operator approval and child-ticket filing

## Signature variance note

Copilot Team (`cp`) signed all position blocks as `Signed-by: chf3198` (the operator's GitHub handle) instead of their team's registry-derived alias. Per `planning/prompts/admin-init.md` "Signature variance handling", admin accepted the verdict content as ratified by the signer and promoted decisions normally. Future Copilot Team amendments should use the registry-derived alias (Soren / Orion / Milo per active model). Each PASS-with-variance decision below carries a `signature_variance: cp` note for traceability.

---

## D-001 — @-include claim verification

```yaml
decision_id: D-001
title: harness-goals.instructions.md is NOT auto-@-included by runtime entry points
threads: []
opened_utc: 2026-05-07T22:00Z
resolved_utc: 2026-05-08T04:30Z
positions:
  cc: {verdict: agree, ref: "[CC-RD §0.2]"}
  cx: {verdict: agree, ref: "[CX-RD sources]"}
  cp: {verdict: agree, ref: "[CC-RD §0.2]"}
final: PASS
signature_variance: cp
implementation_note: validation-only; no code change. Document the actual loading paths (global-standards inline + goal_lens.py hook).
```

## D-002 — Wiki "Always-Loaded Surfaces" claim is wrong

```yaml
decision_id: D-002
title: Fix wiki/concepts/harness-goals.md "Always-Loaded Surfaces" list
threads: []
opened_utc: 2026-05-07T22:00Z
resolved_utc: 2026-05-08T04:30Z
positions:
  cc: {verdict: agree}
  cx: {verdict: agree, ref: "[CX-RD C4]"}
  cp: {verdict: agree}
final: PASS
signature_variance: cp
implementation_note: single-file edit at wiki/concepts/harness-goals.md#L33-L38; remove or qualify the always-loaded claim per actual runtime loading.
```

## D-003 — Aggregated G1..G9 enforcement + evidence map

```yaml
decision_id: D-003
title: Ship aggregated G1..G9 enforcement+evidence map as a wiki concept page
threads: []
opened_utc: 2026-05-07T22:00Z
resolved_utc: 2026-05-08T04:30Z
positions:
  cc: {verdict: agree, ref: "[CC-RD §4]+[CC-RD §5]"}
  cx: {verdict: agree, ref: "[CX-RD enforce]"}
  cp: {verdict: agree, ref: "[CP-RD seedmap]"}
final: PASS
signature_variance: cp
implementation_note: combine CC §4-§5 tables, CP seedmap rows, and CX enforce-G1..G9 inventory; new file wiki/concepts/harness-goal-controls.md.
```

## D-004 — global-task-router phrasing fix

```yaml
decision_id: D-004
title: Reword instructions/global-task-router.instructions.md "second-highest priority goal"
threads: []
opened_utc: 2026-05-07T22:00Z
resolved_utc: 2026-05-08T04:30Z
positions:
  cc: {verdict: agree}
  cx: {verdict: agree, ref: "[CX-RD C3] HIGH severity"}
  cp: {verdict: agree}
final: PASS
signature_variance: cp
implementation_note: edit at instructions/global-task-router.instructions.md#L3 — replace "second-highest priority goal" with "zero-cost execution lane after free/auto, subject to Governance and Quality" or equivalent.
```

## D-005 — session_context.py spelling normalization

```yaml
decision_id: D-005
title: Normalize "ZeroCost" -> "Zero Cost" in hooks/scripts/session_context.py
threads: []
opened_utc: 2026-05-07T22:00Z
resolved_utc: 2026-05-08T04:30Z
positions:
  cc: {verdict: agree}
  cx: {verdict: agree, ref: "[CX-RD C5] LOW"}
  cp: {verdict: agree}
final: PASS
signature_variance: cp
implementation_note: single-token edit at hooks/scripts/session_context.py#L72.
```

## D-006 — Runtime-deploy sync gap

```yaml
decision_id: D-006
title: Implementation rollout MUST include sync verification evidence
threads: []
opened_utc: 2026-05-07T22:00Z
resolved_utc: 2026-05-08T04:30Z
positions:
  cc: {verdict: agree}
  cx: {verdict: agree, ref: "[CX-RD C8] HIGH"}
  cp: {verdict: agree}
final: PASS
signature_variance: cp
implementation_note: add evidence requirements to implementation child tickets — `npm run sync:codex`, `npm run sync:claude` (where applicable), `npm run hamr:sync-verify`. Reference scripts/global/hamr-sync-verify.js#L19.
```

## D-007 — Generated JSON contract for goal definitions

```yaml
decision_id: D-007
title: Add generated/derived JSON contract for goal definitions
threads: []
opened_utc: 2026-05-07T22:00Z
resolved_utc: 2026-05-08T04:30Z
positions:
  cc: {verdict: agree, caveat: "JSON is generated/derived, not second canonical"}
  cx: {verdict: agree, caveat: "JSON is generated/derived, not second canonical"}
  cp: {verdict: agree}
final: PASS
signature_variance: cp
implementation_note: build script that generates a JSON view from instructions/harness-goals.instructions.md. Markdown remains the normative source. JSON is for programmatic access (lint, mirrors, tests). Lock: any direct edit to the JSON file fails CI.
```

## D-008 — role-baton-routing.instructions.md drift

```yaml
decision_id: D-008
title: Reconcile role-baton-routing with current ticket-driven-work taxonomy v1.1
threads: []
opened_utc: 2026-05-07T22:00Z
resolved_utc: 2026-05-08T04:30Z
positions:
  cc: {verdict: agree}
  cx: {verdict: agree}
  cp: {verdict: agree, ref: "[CP-RD conflicts] HIGH"}
final: PASS
signature_variance: cp
implementation_note: instructions/role-baton-routing.instructions.md#L12-L21 — reconcile "backlog/todo" wording and old board name to current 10-status taxonomy in instructions/ticket-driven-work.instructions.md.
```

## D-009 — harness-goals @-include in CLAUDE.md/AGENTS.md

```yaml
decision_id: D-009
title: Auto-load harness-goals.instructions.md (or byte-identical equivalent) in runtime entry points
threads: []
opened_utc: 2026-05-07T22:00Z
resolved_utc: 2026-05-08T04:30Z
operator_decision_utc: 2026-05-08T (operator chose hybrid B / B+ tier)
positions:
  cc: {verdict: agree, note: "G1>G3; implementation may choose @-include OR goal_lens.py-only with byte-identity CI lint as cheaper equivalent"}
  cx: {verdict: agree, ref: "[CX-RD C2]"}
  cp: {verdict: agree}
final: PASS
signature_variance: cp
implementation_choice: HYBRID (operator-directed)
implementation_note: |
  Operator chose tiered hybrid:
  - Tier B (default, most session types): goal_lens.py-only injection of the priority sentence + CI lint enforcing byte-identity between goal_lens.py and harness-goals.instructions.md#L8-L9. Cheap; ~0 token cost per session.
  - Tier B+ (for final-reviewer roles, e.g. Consultant): expanded goal definitions ALSO injected. Implementation options:
      * goal_lens.py reads the active role from session context and injects expanded definitions when role == 'consultant' (preferred — single injection point).
      * OR @-include harness-goals.instructions.md only in consultant-role session entry points if role-specific entry points exist.
  Rationale: G1 (Governance) governance-clarity is highest where review rigor is highest (Consultant role); G3 (Zero Cost) protected for the high-volume general work (Manager/Collaborator/Admin). Best of both options.
```

## D-010 — Effort estimate baseline

```yaml
decision_id: D-010
title: Use 1.0-1.2d planning baseline; revisable upward if scope grows
threads: []
opened_utc: 2026-05-07T22:00Z
resolved_utc: 2026-05-08T04:30Z
positions:
  cc: {verdict: disagree-not-blocking, note: "1.5d more honest with sync proof + role-baton drift"}
  cx: {verdict: disagree-not-blocking, note: "1.2d tight but acceptable as baseline"}
  cp: {verdict: disagree-not-blocking, note: "1.0d-1.2d depending on automation depth"}
final: PASS
signature_variance: cp
implementation_note: 3-team consensus is "1.0-1.2d as planning baseline; explicit reach to ~1.5d is acceptable if D-006 + D-008 scope expands during implementation."
```

## D-011 — CI drift-lint for priority-sentence

```yaml
decision_id: D-011
title: Add CI drift-lint detecting priority-sentence drift across 6 mirror surfaces
threads: []
opened_utc: 2026-05-08T03:16Z (proposed by cc)
resolved_utc: 2026-05-08T04:30Z
positions:
  cc: {verdict: agree}
  cx: {verdict: agree, ref: "[CX-RD C1]"}
  cp: {verdict: agree}
final: PASS
signature_variance: cp
implementation_note: lint compares canonical line in instructions/harness-goals.instructions.md#L8-L9 against the 5 mirror surfaces (global-standards, goal_lens.py, .codex/AGENTS.md, .github/copilot-instructions.md, wiki/concepts/harness-goals.md). Advisory-only for 2 weeks; promote to hard gate after stable.
```

---

## Implementation child tickets (recommended; awaiting operator approval)

The synthesis decisions imply the following child-ticket plan. Per protocol §10, no child implementation tickets were created in this phase — the operator must approve before tickets are filed.

| Suggested ticket | Maps to | Effort | Dependencies |
| --- | --- | --- | --- |
| Fix wiki "Always-Loaded Surfaces" claim | D-002 | 0.1d | — |
| Implement D-009 hybrid: byte-identity CI lint + role-aware expanded-definition injection in goal_lens.py for consultant role | D-009 | 0.4d (B + B+ tier) | operator chose hybrid |
| Reword global-task-router phrasing | D-004 | 0.1d | — |
| Normalize "ZeroCost" -> "Zero Cost" in session_context.py | D-005 | 0.05d | — |
| Reconcile role-baton-routing with v1.1 taxonomy | D-008 | 0.3d | — |
| Build aggregated G1..G9 enforcement+evidence wiki concept | D-003 | 0.3d | — |
| Build generated JSON contract for goal definitions | D-007 | 0.3d | D-003 |
| Add CI drift-lint for priority sentence (advisory-first) | D-011 | 0.3d | D-002, D-005 (so lint doesn't fail on day 1) |
| Document sync-verification requirements in rollout instructions | D-006 | 0.1d | — |
| Validate @-include actual loading paths (D-001 documentation outcome) | D-001 | 0.1d | — |
| **Total** | | **~1.5-1.9d** | |

This is above the D-010 baseline of 1.0-1.2d, consistent with the 3-team disagree-not-blocking pattern on that decision (all teams said 1.2d was tight). Operator may scope-cut for the first PR and defer items.

## Synthesis-process learnings (for future runs)

1. **Single-prompt kickoff failed**: cramming admin and participant roles into one message produced format/signing errors. Two-phase (prep + init) is the canonical pattern going forward (`planning/prompts/`).
2. **Model-team mismatch**: Copilot Team's active model `gpt-5.3-codex` belongs to team `codex` per registry. Prep prompt now requires explicit model check before the team can derive its alias.
3. **Anti-spam guard worked**: CC and CX correctly avoided re-posting on quiescent decisions when re-invoked. CX correctly added a single new D-011 block when a new decision was proposed after their first pass.
4. **Cross-team value was high**: each team independently surfaced findings the others missed (CC: @-include correction; CP: role-baton-routing drift; CX: 5 unique findings including phrasing drift, spelling drift, sync gap, JSON contract proposal). Three independent passes were not redundant.
