---
title: "Operator memory cleanup post-Epic #2451"
date: 2026-05-30
epic: 2451
ticket: 2461
lane: docs-research
test_strategy: peer-review
status: complete
---

# Operator-memory cleanup post-Epic #2451 state-authority refactor

## Inventory

The Phase-0 synthesis (#2452) flagged 8+ memory anchors potentially obsolete after the state-authority refactor. Audit results:

| Anchor | Disposition | Reason |
|---|---|---|
| `feedback_state_store_dual_variants` | **SUPERSEDED** by Move 1 | Dual-file desync class eliminated — local cache becomes read-only TTL when `MEGINGJORD_DERIVE_ROLES_FROM_GH=1`; canonical roles derive from GitHub labels |
| `feedback_admin_ci_gate` | **STILL RELEVANT** | About admin verifying CI green before merge — orthogonal to state authority; baton flow unchanged |
| `feedback_admin_authority_and_baseline_drift` | **STILL RELEVANT** | Admin override scope for pre-existing baseline drift — orthogonal |
| `feedback_bash_sleep_block_recovery` | **STILL RELEVANT** | Tool-block recovery + background-watcher dispatch — orthogonal to state authority |
| `feedback_all_baton_artifacts_before_pr` | **STILL RELEVANT** | 4-artifact precondition for PR — baton flow unchanged |
| `feedback_baton_artifact_format_pitfalls` | **STILL RELEVANT** | Regex traps (markdown-bold, prose-collision, tdd-pyramid spec) — independent of state authority |
| `feedback_prose_collision_non_baton_comments` | **STILL RELEVANT** | Phantom regex matches in non-baton comments — independent of state authority |
| `feedback_team_model_prose_collision` | **STILL RELEVANT** | Closeout-schema regex captures Team&Model prose — independent |
| `feedback_role_colon_prose_collision` | **STILL RELEVANT** | `role:NAME` prose collision — independent |
| `feedback_flaw_emission_failure_word` | **STILL RELEVANT** | `\bfailure\b` false-positives — independent |

**Net cleanup**: 1 anchor superseded, 9 anchors validated as orthogonal and retained.

## Honest scope guard

The Phase-0 synthesis estimated "8+ obsolete memory anchors." This audit shows the actual impact is narrower — only `feedback_state_store_dual_variants` is structurally obsoleted by the architecture change. The other anchors document independent concern classes (baton format, regex traps, admin override behavior, tool-block recovery) that remain valid regardless of where role state lives.

This is a feature, not a defect: the migration is surgical — it closes ONE failure class cleanly without invalidating accumulated operator wisdom on adjacent topics. Per `feedback_red_team_loop_scope_preservation` (candidate anchor from this session's iter-1 critique), scope-preserving changes are the goal.

## Applied actions

1. `feedback_state_store_dual_variants.md` updated with supersession note (operator-personal memory at `~/.claude/projects/-home-curtisfranks-devenv-ops/memory/`)
2. Coordination comment posted on Epic #2399 (operator-memory promotion) confirming no canonical-instruction conflict
3. No anchors deleted — supersession preserves history; future operators can read the trajectory

## Coordination with Epic #2399

Epic #2399 promotes operator-memory rules-of-thumb to canonical instructions. None of the anchors above are slated for promotion to instructions/ (per current #2399 child scope). No conflict.

## Verification

- The `feedback_state_store_dual_variants.md` file at the operator-memory path has its 2026-05-30 #2444 update preserved, plus a new section linking to this audit + #2451 Move 1 as the structural replacement
- This document closes Phase-1 Move 6 of Epic #2451

## Related

- Epic #2451 (parent)
- #2452 (Phase-0 synthesis, source)
- #2456-2460 (Phase-1 Moves 1-5, shipped)
- #2399 (adjacent: operator-memory promotion to instructions)
- `feedback_state_store_dual_variants` (the single anchor superseded)
