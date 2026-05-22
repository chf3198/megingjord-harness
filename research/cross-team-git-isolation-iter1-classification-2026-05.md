# Iteration-1 Red-team Classification — Epic #2071

Phase-0 ticket: this Epic #2071. Iter 1 of N.
Guest collaborator: qwen2.5-coder:32b @ fleet (Tailscale 100.91.113.16:11434).

## Verdict summary

| Section | Verdict | Detail |
|---|---|---|
| A — Design critiques | 2 DISPUTE / 3 ACCEPT | Decisions #2 (flock) + #5 (Layer 5) disputed; #1 + #3 + #4 accepted |
| B — Score disagreements | G2, G6, G10 | All cite the flock-bypass concern + Layer 5 complexity |
| C — New attacks | 2 surfaces | Stale git index files; worktree-creation race |
| D — A+ verdict | NOT-YET-A+ | 3 outstanding items |
| E — Phase-1 slate | All 12 correctly scoped | No changes needed to child decomposition |

## ACCEPT (incorporated into v2)

| # | Iter-1 finding | V2 amendment |
|---|---|---|
| RT1 | Flock advisory bypass risk | V2 Layer 2 explicit: bypass-tolerated by design; two-layer enforcement REQUIRED (flock + cross-team-lease registry); pre-tool-guard checks BOTH before mutation; non-cooperating process can bypass but every harness session is gated |
| RT2 | Layer 5 doesn't cover all stale-state sources | V2 Layer 5 expanded: state files (existing), stale git index files (NEW), stale worktree directories (NEW); stash residue covered by C10 |
| RT3 | Stale Git Index Files attack | V2 Layer 5 expansion + new C13 (stale-worktree-and-index cleanup) |
| RT4 | Worktree-creation race conditions | V2 C2 expanded: pre-tool-guard acquires main-checkout flock during worktree-add; sequential worktree creation per session |

## PARTIAL-ACCEPT (with modification)

| # | Iter-1 finding | Modification |
|---|---|---|
| RT5 | G10 Maintainability complexity concern | PARTIAL: the layered-defense cost IS real, but the alternative (current chaos: 10 stashes, main-as-workspace, cross-team conflicts) is worse. V2 documents the tradeoff explicitly in §"Maintainability tradeoff acknowledged" and keeps G10=9 with justification |

## REJECT (with rationale)

None outright rejected. All iter-1 findings are concrete and actionable.

## Iter-2 expected score after amendments

| Goal | v1 | v2 expected | Rationale for delta |
|---|---|---|---|
| G1 Governance | 10 | 10 | Unchanged — already at ceiling |
| G2 Quality | 9 | 10 | Two-layer enforcement (flock + lease) addresses bypass concern; C13 closes stale-state gap |
| G3 Zero Cost | 10 | 10 | Unchanged |
| G4 Privacy | 9 | 10 | Stale-index cleanup closes residual data-leakage surface |
| G5 Portability | 10 | 10 | Unchanged |
| G6 Resilience | 9 | 10 | Two-layer enforcement + worktree-creation race protection improves degradation paths |
| G7 Throughput | 9 | 9 | Unchanged (parallel CI gains intact) |
| G8 Observability | 9 | 10 | Two-layer enforcement carries observable lock + lease state |
| G9 Interoperability | 10 | 10 | Unchanged |
| G10 Maintainability | 9 | 9 | Complexity acknowledged + documented tradeoff; not promoted |

V2 expected mean: 9.7 / 10 (up from 9.4 in v1).

## References

- Iter-1 raw response: `/tmp/rt2071-iter1-text.md`
- V1 synthesis: `research/cross-team-git-isolation-2026-05.md`
- V2 synthesis: `research/cross-team-git-isolation-v2-2026-05.md` (next deliverable)
