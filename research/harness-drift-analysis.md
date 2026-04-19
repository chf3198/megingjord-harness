# Harness Drift Analysis — DevEnv Ops

**Date**: 2025-07-14
**Ticket**: #257 (Epic #256)
**Status**: Complete — findings posted, countermeasures designed

## Summary Table

| Metric | Current | Projected | Target |
|---|---|---|---|
| Ticketless commits | 50.6% | <2% | 0% |
| Non-compliant branches | ~25% | <1% | 0% |
| Missing PR linkage | 10% | <2% | 0% |
| Scope bundling | ~15% | <5% | 0% |
| Overall compliance | ~45% | >95% | 100% |

## Drift Taxonomy (6 Categories)

1. Git Protocol — branch naming, commit refs, PR linkage
2. Baton Sequencing — skipped Manager, no handoff comments
3. Ticket Lifecycle — work without tickets, missing labels
4. Scope Bundling — multiple changes per branch
5. Tool Usage — manual steps where automation exists
6. Enforcement Gap — hooks exist but not activated

## Root Causes (9 Identified)

| ID | Root Cause | Severity |
|---|---|---|
| RC1 | Branch validation hook not installed | CRITICAL |
| RC2 | commit_ticket_gate uses "ask" not "deny" | HIGH |
| RC3 | No branch-creation PreToolUse guard | HIGH |
| RC4 | Helpfulness bias overrides governance | HIGH |
| RC5 | Skills loaded on-demand (65% confidence) | MEDIUM |
| RC6 | Instruction volume exceeds attention budget | MEDIUM |
| RC7 | SubagentStart hook missing | MEDIUM |
| RC8 | PreCompact hook missing | MEDIUM |
| RC9 | No real-time drift scoring | LOW |

## Key Academic Finding

> Advisory constraints decay. Executable constraints persist.
> — Liu et al. (2023), Dongre et al., Menon et al.

Enforcement hierarchy: deny hooks (99%) > ask hooks (80%)
> instructions (70%) > skills (65%) > convention (0%).

## Countermeasures (10 Designed)

| Priority | CM | Effort | Impact |
|---|---|---|---|
| 1 | CM2: ask→deny in commit gate | 1 line | Critical |
| 2 | CM1: Install branch git hook | 1 cmd | Critical |
| 3 | CM3: Branch creation guard | ~15 lines | High |
| 4 | CM7: Session anchor governance | ~10 lines | High |
| 5 | CM4: active_ticket gate | ~10 lines | High |
| 6 | CM6: PreCompact hook | new file | Medium |
| 7 | CM5: SubagentStart hook | new file | Medium |
| 8 | CM9: Drift scoreboard | ~30 lines | Medium |
| 9 | CM10: CI branch enforcement | workflow | Medium |
| 10 | CM8: Instruction dedup audit | research | Low |

## Actionable Next Steps

1. Create implementation tickets for CM1-CM10
2. Prioritize CM2 + CM1 (immediate, minimal effort)
3. Schedule CM3-CM7 as a hardening sprint
4. Build drift monitoring (CM9) for ongoing measurement
5. Run dedup audit (CM8) as separate research task

## Sources

- wiki/sources/agent-drift-root-causes.md
- wiki/sources/agent-drift-mitigations.md
- wiki/concepts/governance-enforcement.md
- wiki/concepts/protocol-enforcement.md
- wiki/syntheses/devenv-ops-enforcement-architecture.md
- raw/articles/agent-drift-*.md (7 articles)
- NeMo Guardrails (NVIDIA) — github.com/NVIDIA/NeMo-Guardrails
- Guardrails AI — docs.guardrailsai.com

*Last updated: 2025-07-14*
