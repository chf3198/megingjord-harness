---
title: "Antigravity Close-Without-Merge drift surface mapping (Phase-0)"
date: 2026-05-30
epic: 2362
ticket: 2470
lane: docs-research
test_strategy: peer-review
status: draft
---

# Antigravity Close-Without-Merge drift surface mapping

Phase-0 audit for Epic #2362. Maps the 3 drift vectors observed across #2360 (now closed) and #2054 lifecycle. Feeds Phase-1 remediation children (#2471 + #2472).

## Evidence base

| Incident | Class | Resolved by |
|---|---|---|
| #2360 — "Remediate Antigravity Governance Parity & Hook Validator Blind-Spots" | canonical-main write protection blind-spot on tool names beyond `Write`/`Edit` | Closed; informs this audit |
| #2054 — Phase-1 C4 wiki ingest by Antigravity | Lifecycle validation surfaced signer fidelity + isolation gaps | Closed; informs this audit |

## Audit topic 1: Worktree isolation bypass

**Finding**: Antigravity Orchestrator runtime defaulted to canonical main checkouts because its internal tool-naming convention diverged from the validator allowlist.

**Root cause** (per #2360):
- `canonical_main_enforcer.py` (pre-#2360) gated only on `tool_name in {"Write", "Edit", ...}`
- Antigravity's runtime exposed write tools under different names (e.g., `apply_patch`, `create_file`)
- Result: writes to canonical main were not intercepted; Antigravity sessions committed directly on `main` branch

**Status post-#2360**: tool-name allowlist expanded. But the underlying gap class — "validator coverage assumes Claude Code + Copilot tool taxonomy" — recurs whenever a new orchestrator joins.

**Remediation hook (Phase-1)**: signer-based detection complements tool-name-based detection (#2471). When ANY commit arrives on main with an Antigravity-team signer, advisory warning fires regardless of tool-name path. Defense-in-depth.

## Audit topic 2: Signer Registry + Baton integration parser gaps

**Finding**: Signer fidelity violations occurred when Antigravity-authored baton artifacts used signer aliases inconsistent with the `inventory/team-model-signatures.json` registry. Validators silently accepted because they parsed the `Signed-by:` line literally.

**Root cause** (cross-referencing memory `feedback_signer_alias_derivation`):
- Required: human alias derived from team + model + role via `agent-signature.js`
- Observed (Antigravity): invented aliases (e.g., names not in the canonical Cole/Mira/Yara registry pattern)
- Validator behavior pre-#2370: `Signed-by: X` was accepted as long as the field was present

**Status post-#2370 (cross-team-response-fidelity validator)**: TEAM_RESPONSE artifacts now check signer-team match. But the broader baton-artifact validation chain still treats invented aliases as advisories, not blockers.

**Remediation hook (Phase-1)**: this Epic's Phase-1 detection (#2471) flags Antigravity-signed commits on main for human review. Does NOT block (Tier B++ caution); produces JSONL incident for trend tracking.

## Audit topic 3: Lease layer

**Finding**: Lease acquisition checks (multi-team leases, #1111 / Move 3 of Epic #2451) did not enforce ticket-specific isolation during local Antigravity invocations because the lease layer ran post-checkout, after Antigravity already had a working directory on main.

**Root cause**:
- Lease layer was designed as a remote-side serializer (HAMR KV merge-claim, just shipped per #2458)
- It does NOT intercept local-side worktree creation
- Antigravity sessions create their working area BEFORE any lease-aware tool fires
- By the time the lease check runs, the worktree-isolation invariant is already violated

**Status post-Epic #2451 (#2458 merge-claim primitive)**: cross-team merge serialization is in place at the merge step, but local worktree isolation is still operator-discipline rather than enforced.

**Remediation hook (Phase-1b)**: #2472 documents the operator-discipline pattern (default-to-worktree) for Antigravity team. Future Phase-2 work could extend canonical_main_enforcer to also reject any TRACKED-FILE write from main checkout regardless of signer — that's a larger refactor outside this Epic's scope.

## Cross-reference to Epic #2356 (sibling)

Epic #2356 ("Harden governance guardrails against low-capability model drift") shares the surface-area concern. Per epic body sibling claim:
- #2356 hardens governance guardrails generally
- #2362 (this Epic) addresses the Antigravity-specific manifestation

Coordination: Phase-1 enforcer wiring per this Epic should compose with #2356 Phase-1 enforcers when the latter ship. No conflict; complementary.

## Phase-1 children scope (already filed)

- **#2471 (P2 lane:code-change)**: canonical_main_enforcer Antigravity-signer detection (advisory mode, feature-flagged)
- **#2472 (P3 lane:docs-research)**: Antigravity worktree-pattern howto

## Open questions for Phase-1

1. Should advisory detection emit to `~/.megingjord/incidents.jsonl` only, or also surface in dashboard?
2. Is the Antigravity team's worktree default a tooling-side concern (file follow-on with their team) or harness-side (this Epic)?
3. When does advisory mode escalate to blocking? Replay-eval per #1771 + #1827 pattern.

## Honest scope guard

Per `feedback_red_team_loop_scope_preservation`: this Phase-0 deliberately scopes Phase-1 to advisory-only detection + howto. Full blocking enforcement requires coordination with Antigravity team representatives (not available in this session) and would risk false-positive lockout. Phase-1 ships the surface area; escalation to blocking is a future Phase-2.

## Related

- Epic #2362 (parent)
- #2356 (sibling Epic)
- #2360 (#2360 closed; provides validator blind-spot evidence)
- #2054 (closed; provides lifecycle drift evidence)
- #2370 (cross-team-response-fidelity validator)
- #2451 / #2458 (merge-claim primitive; complementary serializer)
- Memory: `feedback_signer_alias_derivation`
