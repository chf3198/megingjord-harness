# Phase-0 Synthesis — Programmatic Guardrails for Local-Worktree Git Protocols

> **Epic:** #3854 · **Phase-0 child:** #3855 · **Date:** 2026-07-27
> **Lane:** `lane:docs-research` · **Strategy:** `peer-review`
> **Signed-by:** Nova Mason · **Team&Model:** claude-code:claude@local · **Role:** manager

## Executive summary

The harness already guardrails most git protocols (canonical-main RO, one-ticket-per-worktree, branch
naming, ticket-ref commits, merge-from-testing, push gates). The remaining exposure is a **small,
specific class**: protocols that are **declared-not-verified** (freshness fields trusted, never
recomputed) or **un-intercepted at the decision moment** (raw `git worktree add` bypasses the
fetch-first helper). Two real drifts this session came from exactly this class — a child branched off a
**stale `origin/main`**, and a census run against the **stale local checkout**. Fix: apply the harness's
own doctrine — **prevention over reaction (local guardrail first, CI second)** and **verify, don't
trust** (the #3826/#3672 upgrade) — at each role's git moment. Net-surface-neutral: every fix extends an
existing surface.

## AC-R1 — Git-protocol → guardrail-status map

| # | Protocol | Enforcing surface | Status |
|---|---|---|---|
| 1 | One dedicated worktree+branch per ticket | `one_ticket_per_worktree.py`, `worktree_ticket.py` | ✅ guardrailed |
| 2 | Branch name `<type>/<N>-slug` | `validate-branch-name.sh` (`branch-name-regex`) | ✅ guardrailed |
| 3 | Canonical main read-only (no tracked writes/commits/switch) | `canonical_main_enforcer.py`, `canonical_main_wip_check.py` | ✅ guardrailed |
| 4 | Commits reference `#N` | `commit_ticket_gate.py` | ✅ guardrailed |
| 5 | One branch = one ticket = one PR | `one_ticket_per_worktree.py` | ✅ guardrailed |
| 6 | Merge only from `status:testing` + full baton | `baton-authority/merge` (FSM) | ✅ guardrailed |
| 7 | PR branch up-to-date with `main` before **merge** | branch protection `strict: true` (GitHub-side) | ✅ guardrailed |
| 8 | Push preconditions | `pre-push-gates.js` + lefthook | ✅ guardrailed |
| 9 | Merged-branch / worktree teardown | `merged-branch-guard.py`, `worktree-teardown-actuate.js`, `worktree-lifecycle-gate.checkAdmin/Consultant` | 🟡 partial (advisory) |
| 10 | **Fetch-first before branching** | `agent-worktree.sh` fetches — but **raw `git worktree add … origin/main` bypasses it** | ❌ **GAP-A** (un-intercepted) |
| 11 | **Worktree freshness (`worktree_behind_main` / `behind_at_handoff`)** | `worktree-lifecycle-gate.checkCollaborator` + `collab-handoff-rebase-freshness.js` **read the declared number; never recompute** | ❌ **GAP-B** (declared-not-verified) |
| 12 | **`git-freshness-check` counts `behind`** | `git-freshness-check.js` counts vs `origin/main` **without fetching first** → `behind=0` false-negative | ❌ **GAP-B** (same class) |
| 13 | **Governance measurement base** | `governance-surface-census.js` (+ audits) read the **local canonical checkout** (deliberately behind), not `origin/main` | ❌ **GAP-C** (wrong base) |
| 14 | **Deployed hook-path portability** | `hook-symlink-health.js` covers *symlinks*; `install-hooks.sh` can hardcode a **worktree absolute path** into `~/.copilot/hooks/pre-push` → dangling after that worktree is deleted → every push fails | ❌ **GAP-D** (install-path) |

## AC-R2 — Gap → owning Agile role → decision moment

| Gap | Owning role | Decision moment |
|---|---|---|
| GAP-A fetch-before-branch | **Collaborator** | `git worktree add` (starting work) |
| GAP-B verified freshness | **Collaborator** | posting `COLLABORATOR_HANDOFF` (+ pre-push) |
| GAP-C measurement base | **Consultant** (and any measurer) | running census/audit at closeout |
| GAP-D hook-path portability | **Admin / IT** | worktree teardown + hook install/deploy |

## AC-R3 — Per-gap prevention-first guardrail design (hook → validator → test → CI)

- **GAP-A — fetch-before-branch (PreToolUse hook; zero-token; strongest).** Extend `pretool_guard.py` to
  intercept a raw `git worktree add … origin/main`: if `git fetch origin main` has not run recently (or
  the tracked `origin/main` is behind the remote HEAD), **deny with redirect** → run `agent-worktree.sh`
  (which fetches) or `git fetch origin main` first. Emits a `worktree.stale-base-denied` v3 event (G8).
- **GAP-B — verify freshness, don't trust it (validator).** Upgrade `worktree-lifecycle-gate.checkCollaborator`
  and `collab-handoff-rebase-freshness.js` to **recompute** `behind` via `git-freshness-check.behindCount()`
  (after a fetch) and **reject** if declared ≠ actual, or actual > 0 on a `lane:code-change` handoff. Fix
  `git-freshness-check.js` to **fetch before counting** so `behind=0` is trustworthy.
- **GAP-C — measurement base guard (shared shim).** A `assertMeasuringOriginMain()` / auto-`git fetch`
  helper that governance-measurement scripts (`governance-surface-census.js`, audit) call so reads resolve
  against `origin/main`, not the stale local tree — mirroring the `loadLocalEnvOnce()` shim pattern.
- **GAP-D — hook-path portability.** `install-hooks.sh` must not hardcode a worktree absolute path (resolve
  to the canonical checkout / a relative path); extend `hook-symlink-health.js` (or `hamr-sync-verify.js`)
  to detect a dangling appended hook path and self-heal to the canonical script.

## AC-R4 — Verify-don't-trust principle (binding)

Every freshness field a role *declares* (`worktree_behind_main`, `behind_at_handoff`) MUST be
**recomputed from git**, not parsed-and-trusted — exactly the free-text→verified-receipt upgrade the
`#3826` plan-rating gate and `#3672` independence gate made. A declared-only freshness is treated as
absent (fail-closed on `lane:code-change`).

## AC-R5 — Cross-family council verdict

3 genuinely disjoint non-Anthropic families: mistral **95** / meta **97** / gemma **98** → median **97**, min 95, **Gwet AC1 = 1.0** (chance-corrected). Verified `kind:review` receipt `a281f6c3df23a545` in `governance/cross-family-consensus.jsonl` (meta + mistral PASS). **VERDICT: PASS.**

## Phase-1 slate (materialized after Phase-0 ≥90; one child per gap)

1. **P1-a (GAP-A)** — PreToolUse `fetch-before-branch` hook intercepting raw `git worktree add`; redirect to `agent-worktree.sh` / fetch-first; G8 event.
2. **P1-b (GAP-B)** — verified worktree freshness: recompute `behind` in `checkCollaborator` + `collab-handoff-rebase-freshness`; `git-freshness-check` fetches-before-count; reject declared≠actual.
3. **P1-c (GAP-C)** — `origin/main` measurement-base shim; `governance-surface-census` + audits fetch/read `origin/main`.
4. **P1-d (GAP-D)** — `install-hooks.sh` path-portability + `hook-symlink-health`/`hamr-sync-verify` dangling-hook-path detection + self-heal.

## Recommendation

Ship GAP-A first (the PreToolUse hook is the highest-leverage prevention — it stops the stale-base defect
at the git moment). GAP-B/C/D are verifier/shim upgrades to existing surfaces. All are net-positive
tightening reusing existing scripts; no new bypass surface.
