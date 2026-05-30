---
title: Operator-memory promotion triage matrix (Phase-0 #2399)
date: 2026-05-30
lane: docs-research
source_tickets: [2399, 2413]
signers:
  manager: Orla Mason (claude-code:opus-4-7@local)
  collaborator: Orla Harper (claude-code:opus-4-7@local)
  consultant: Orla Vale (claude-code:opus-4-7@local)
---

# Phase-0 #2413 — Operator-memory promotion triage matrix

Per Epic #2399 AC1. Triages 42 memory files at `/home/curtisfranks/.claude/projects/-home-curtisfranks-devenv-ops/memory/feedback_*.md` for promotion to canonical `instructions/` surface.

## 1. Triage criteria (per Epic #2399)

Each memory file scored on 3 axes:
- **Scope**: applies-to-all-teams | claude-code-specific | personal-preference
- **Type**: canonical-true-fact | situational-guidance | recovery-recipe
- **Incident-prevention claim**: would-have-prevented-X-incident | observability-only | meta-discipline

A promotion candidate satisfies: scope=applies-to-all + type=canonical-true-fact + incident-prevention=would-have-prevented-X.

## 2. Triage summary (42 files)

```
Promotion candidates (all-3-criteria met):     8 files  (19%)
Strong recovery recipes (different shape):     6 files  (14%)
Claude-Code-team-specific guidance:           14 files  (33%)
Personal-preference / operator-stylistic:     14 files  (33%)
```

## 3. The 8 promotion candidates

| # | Memory file | Recommended canonical location |
|---|---|---|
| 1 | `feedback_all_baton_artifacts_before_pr.md` | `instructions/role-baton-routing.instructions.md` §"Pre-PR baton-artifact sequencing" |
| 2 | `feedback_baton_artifact_format_pitfalls.md` | `instructions/role-baton-routing.instructions.md` §"Prose-collision pitfalls" |
| 3 | `feedback_team_model_prose_collision.md` | merge into #2 above |
| 4 | `feedback_calendar_thresholds_in_agentic_systems.md` | `instructions/workflow-resilience.instructions.md` §"Replay-eval over calendar thresholds" |
| 5 | `feedback_sync_sh_reverse_direction_trap.md` | already documented in `instructions/global-standards.instructions.md` §Canonical-main checkout policy; close memory anchor |
| 6 | `feedback_consultant_tier3_emission.md` | `instructions/role-baton-routing.instructions.md` §"Consultant Tier-3 escalation contract" |
| 7 | `feedback_signer_alias_derivation.md` | `instructions/team-model-signing.instructions.md` §"Canonical alias enforcement" |
| 8 | `feedback_no_developer_flow_questions_to_client.md` | `instructions/operator-identity-context.instructions.md` §"Client role boundary" |

## 4. The 6 strong recovery recipes

These belong in `docs/howto/` rather than instructions/ because they describe RECOVERY rather than POLICY:

- `feedback_bash_sleep_block_recovery.md` → `docs/howto/bash-tool-block-recovery.md`
- `feedback_worktree_symlink_validation.md` → `docs/howto/worktree-symlink-recovery.md`
- `feedback_state_store_dual_variants.md` → `docs/howto/state-store-recovery.md`
- `feedback_fleet_rater_wake_mechanism.md` → `docs/howto/fleet-review-async-pattern.md`
- `feedback_lane_label_vs_handoff_field.md` → `docs/howto/lane-label-recovery.md`
- `feedback_anneal_decision_required_not_optional.md` → `docs/howto/anneal-decision-protocol.md`

## 5. Phase-1 sequencing recommendation

Ship in 3 batches per dependency / scope:

**Batch A (highest impact, lowest risk; 4 PRs):**
1. Merge #2 + #3 (prose-collision pitfalls) into role-baton-routing
2. #1 (all-artifacts-before-PR) into role-baton-routing
3. #6 (Consultant Tier-3) into role-baton-routing
4. #7 (signer-alias canonical) into team-model-signing

**Batch B (instruction-policy clarifications; 3 PRs):**
5. #4 (calendar-threshold guard) into workflow-resilience
6. #8 (client role boundary) into operator-identity-context
7. #5 close as already-documented (no PR; just memory cleanup)

**Batch C (recovery-recipe docs; 6 PRs, can run parallel):**
8-13. The 6 recovery recipes → `docs/howto/` files

Total: ~13 small PRs (most ≤100 lines diff). Memory files updated to reference canonical location after promotion lands (per Epic #2399 AC4).

## 6. Open questions for Phase-1

- Should promoted memory files be DELETED or LEFT AS REFERENCES (pointer to canonical location)? Recommendation: leave as references so future-Claude-Code sessions land on the memory file first and follow the link.
- For the 14 claude-code-team-specific entries, should we file a separate Epic for "Claude Code Team operator handbook" rather than promoting to harness instructions? They're valuable but not cross-runtime.
- Should the AC5 pre-commit hook (new-feedback-file advisory) ship in this same Epic or as a follow-on?

Refs Epic #2399 · Refs #1942 Three-Wiki typology · Refs `instructions/wiki-knowledge.instructions.md`
