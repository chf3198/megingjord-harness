# Governance Carve-Outs Registry

Carve-outs are documented exceptions or extensions to baseline governance rules.
Each entry records the rule being relaxed or extended, the rationale, scope, and
originating decision artifact so future operators can audit intent.

| rule_id | description | scope | originating_decision |
|---|---|---|---|
| `closes-vs-refs-deferred-final-carveout` | Deferred-finalize marker accepted as merge-evidence alternative to Closes-keyword | All PRs; cross-runtime (Claude Code, Codex, Copilot) | Epic #2295 Phase-1 P1.3 (#2303) |

---

## closes-vs-refs-deferred-final-carveout

**rule_id**: `closes-vs-refs-deferred-final-carveout`

**conflict resolved**: PR template instructs authors to use `Refs #N` (not `Closes #N`) to
preserve Consultant terminal-finalize authority. The `merge-evidence-pr-gate` previously
required a `Closes #N` (or `Fixes`/`Resolves`) keyword to confirm the PR commits to closing
its linked issue. These two rules created an irreconcilable conflict for authors following
the template.

**resolution (Option C)**: `merge-evidence-pr-gate` now accepts EITHER:
1. `merge-evidence-deferred-final: #N` — **preferred new form**. Not a GitHub auto-close
   keyword; GitHub will NOT close the issue on merge. Satisfies the harness gate. Consultant
   closes explicitly via `gh issue close #N` after `CONSULTANT_CLOSEOUT`.
2. `Closes #N` / `Fixes #N` / `Resolves #N` — **backward-compat**. GitHub auto-closes on
   merge. Accepted indefinitely for PRs that pre-date this carve-out or that intentionally
   want auto-close behavior.

**scope**: All governed PRs in the Megingjord harness. Cross-runtime portable — Claude Code,
Codex, and Copilot teams may all emit `merge-evidence-deferred-final: #N` in PR bodies.

**originating_decision**: Epic #2295 (Origin Conflict Resolution), Phase-1 child #2303.
Design rationale in issue #2303 body and Phase-0 research child #2296.

**validator**: `scripts/global/megalint/merge-evidence-pr-gate.js` — exports `DEFERRED_FINAL_RE`.

**effective_date**: 2026-05-27
