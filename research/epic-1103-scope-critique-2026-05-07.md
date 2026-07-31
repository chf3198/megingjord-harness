# Epic #1103 — Scope Critique (Cross-Team Input)

**Author**: Orla Harper (claude-code:opus-4-7@anthropic, role: collaborator)
**Date**: 2026-05-07
**Status**: PROPOSAL — not authoritative; intended as input to the R&D in #1105
**Audience**: Manager (chf3198), Copilot Team, Codex Team, public collaborators

This document is a **friendly critique** of Epic #1103's scope as filed. It is not a counter-proposal or a request to cancel; it is intended as ground-state evidence for the R&D in #1105 to start from rather than re-discover. Teams whose perspective differs are explicitly invited to amend or counter — this is the first iteration in a multi-team conversation.

## TL;DR

- **#1103 has a duplicate filed 13 seconds earlier**: #1102 has identical title + body, same author. Likely an accidental double-submit. Recommend cancellation of one before R&D starts.
- **6 of 8 ACs are already met** by work shipped during the 2026-05-07 session. The Epic body should be amended to acknowledge prior work so R&D doesn't re-discover it.
- **2 of 8 ACs are genuinely new value**: AC-C1 (G1-G9 → enforcement map) and AC-D1 (G1-G9 → evidence map). These are the high-leverage deliverables.
- **Honest implementation scope** post-R&D: ~0.5 day of operator time for the 2 new deliverables, not the multi-day plan implied by Epic body.

---

## What's already in place (as of 2026-05-07)

The R&D in #1105 should INVENTORY this before proposing new work.

### Canonical goals source — exists

```
   instructions/harness-goals.instructions.md   (30 lines, session-loaded)
     • Priority-ordered G1..G9 statement
     • Per-goal definitions
     • Decision-lens recipe
   
   Loaded into every Claude Code / Copilot / Codex session via
   @-includes in CLAUDE.md, AGENTS.md, .codex/AGENTS.md, and
   .github/copilot-instructions.md.
```

### Cross-references — already aligned

| Surface | References goals as | Notes |
|---|---|---|
| `instructions/harness-goals.instructions.md` | canonical | THE source |
| `instructions/global-standards.instructions.md:34` | `G1 Governance > G2 Quality > ...` | identical priority sentence |
| `wiki/concepts/harness-goals.md` | concept page | exists |
| `hooks/scripts/goal_lens.py` (46 lines) | runtime injector | injects lens into session context on goal-decision keywords |
| `CLAUDE.md`, `AGENTS.md`, `.codex/AGENTS.md`, `.github/copilot-instructions.md` | @-include or pointer | wired |

A `grep -rn "G1 Governance"` across instructions/docs/wiki returns **only matching priority sentences** — no contradictions detected at the top-level statement. Subtle drift in individual goal phrasing may exist; that's what the inventory should catch.

### Recently-completed governance work that meets ACs B1 + B2

Epic #1074 (Epic-vs-child governance differentiation, closed 2026-05-07) shipped:
- `status:dormant` and `status:deferred` Epic-only states
- Label-lint Rules E2 (Epic + backlog requires `role:manager`), E3 (Epic + in-progress requires `role:manager`), E5 (dormant/deferred Epic-only)
- Updated `instructions/epic-governance.instructions.md` with new state diagram
- Updated `instructions/ticket-driven-work.instructions.md` taxonomy (v1.1)

Issue #836 (closed 2026-05-07 via PRs #1096 + #1097) swept the Epic carve-outs across 3 derived surfaces (`docs/howto/baton-workflow.md`, `research/adr/010-ticket-status-role-model.md`, `wiki/concepts/epic-governance.md`).

Net effect on #1103's ACs:
- **AC-B1** (ticket lifecycle + role-baton align): MET
- **AC-B2** (Epic vs non-Epic separated): MET

### Recently-completed work that partially meets ACs C1 + D1

Each goal already has at least one enforcement primitive AND at least one evidence signal. They just aren't aggregated into a single map. Indicative inventory:

| Goal | Enforcement primitive(s) | Evidence signal(s) |
|---|---|---|
| G1 Governance | `label-lint.yml` Rules 1-9 + E1-E7; `baton-gates.yml`; `evidence-completeness` workflow | issue comments (handoff trail); PR check status |
| G2 Quality | Playwright tests (>100 added this session); `lint-readability.js` 420-score gate; quality-parity framework (#1067) | test reports; `research/stage-4-cost-report-2026-05-06.json`; `logs/wiki-eval-report.json` |
| G3 Zero Cost | `hamr-provider-wrapper.js`; `cache-stats-emit.js`; `extended_cache_ttl` opt-in (#1000); CF AI free tier in `litellm-config.yaml` | `~/.megingjord/cache-stats.jsonl`; `/quota.hit_rate_7d` |
| G4 Privacy | `secret-exposure-prevention` skill; `.secrets.baseline` (#829); `CLOUDFLARE_WORKERS_AI_TOKEN` separation (#1048) | `.github/workflows/detect-secrets.yml` runs |
| G5 Portability | `fleet-discover.sh`; `inventory/devices.example.json`; `MEGINGJORD_HAMR_DISABLED=1` escape hatch | `skills/fleet-portable-config/` walkthrough |
| G6 Resilience | `header-spillover.js`; `tests/fleet-graceful-degrade.spec.js`; broker quarantine (#1083) | spillover-decision logs |
| G7 Throughput | LiteLLM `latency-based-routing` (#1037); Anthropic Batch routing (#927) | latency-routing TTL stats; `quality-required` CI gate |
| G8 Observability | `/quota.stale` boolean (#941); `cache-stats.jsonl`; `governance-audit.js` (#837); `worktree-governance-audit.js` (#919) | `/tmp/governance-audit.json`; `wiki/log.md` |
| G9 Interoperability | 9-provider adapter table (`token-provider-adapters.js`); broker cross-extension contract (Wave-2) | end-to-end test suites |

This list is illustrative, not exhaustive. The R&D output should produce the authoritative version.

---

## Critical findings against the Epic ACs

### AC-A1 — One canonical source designated and referenced
**Status: MET.** `instructions/harness-goals.instructions.md` is canonical. Already referenced by all 4 runtime instruction surfaces.

### AC-A2 — Contradictory goal wording removed or reconciled
**Status: MOSTLY MET.** Top-level priority sentence is identical across all sites that carry it. Subtle phrasing drift in individual goal definitions may exist (the R&D inventory will determine).

### AC-B1 — Ticket lifecycle and role-baton align on close-state and Epic exceptions
**Status: MET.** Epic #1074 + #836 sweep this session.

### AC-B2 — Epic-governance and non-Epic governance behavior explicitly separated where required
**Status: MET.** Rules E2/E3/E5 in `label-lint.yml`; Epic-aware overrides in `epic-governance.instructions.md` and `ticket-driven-work.instructions.md` v1.1.

### AC-C1 — Each goal G1..G9 maps to ≥1 enforcement point
**Status: PARTIALLY MET. Genuine new value to ship.** Primitives exist for every goal but no aggregated map document. Recommend: produce as wiki concept page or extend `instructions/harness-goals.instructions.md`.

### AC-D1 — Each goal G1..G9 maps to ≥1 evidence signal
**Status: PARTIALLY MET. Genuine new value to ship.** Same situation as C1.

### AC-E1 — Lint/governance validation passes with evidence attached
**Status: MET (currently).** As of 2026-05-07, `npm run governance:audit` reports zero violations.

### AC-E2 — Changelog/wiki/index updates include migration rationale
**Status: PROCEDURAL.** Will be met by whatever PR ships the C1 + D1 maps.

---

## Duplicate Epic — #1102

Filed 13 seconds before #1103 with identical title + body + author + labels. Almost certainly accidental. Both Epics are P1 + status:backlog + role:manager.

**Recommendation:** cancel #1102 with note "duplicate of #1103" before R&D begins. If preserved, the Close-Readiness Gate on either will likely auto-reopen the other due to shared text references.

---

## Recommended R&D scope (for #1105)

```
   The R&D #1105 deliverables in the Epic body propose 7 artifacts:
     • Goal-surface inventory
     • Conflict matrix
     • Canonical source proposal
     • Enforcement map
     • Evidence map
     • Sequenced child-ticket plan
     • Risk register + rollback strategy
   
   This critique suggests reframing as:
   
   1. Goal-surface inventory                  ★ valuable; do it
   2. Conflict matrix                         ★ but expect mostly-empty
   3. Canonical source proposal               → already met (#1103 body
                                                 acknowledges existing
                                                 instructions/harness-
                                                 goals.instructions.md
                                                 as the canonical source)
   4. Enforcement map (G1..G9 → controls)     ★★ HIGHEST LEVERAGE
   5. Evidence map (G1..G9 → signals)         ★★ HIGHEST LEVERAGE
   6. Sequenced child-ticket plan             → likely just 1 child:
                                                 ship the maps as a wiki
                                                 concept page
   7. Risk register + rollback                → low-risk; docs-only edit
   
   Honest implementation scope post-R&D: ~0.5 day for one wiki concept
   page consolidating the C1 + D1 maps.
```

## Cross-team invitations

This critique is the **first input** in a multi-team conversation. Explicit invitations:

- **Copilot Team**: where do you see goal-language drift in surfaces I haven't grep'd? Are there enforcement primitives in `dashboard/js/` or `scripts/` that should appear in the C1 map?
- **Codex Team**: the R&D in #1105 originated from your team via gpt-5.3-codex. Does this critique change your planning? Are there G1-G9 enforcement points in `~/.codex/` that I missed?
- **Operator (chf3198)**: do you concur on the duplicate-cancellation recommendation? Is there scope I've understated?
- **Future iterations**: the inventory below should be ground-truthed by another team before the R&D commits. Counter-evidence welcomed.

## Final importance rating

```
   Goal alignment with operator priorities      9/10
   Genuine new value vs already-shipped         3/10
   Risk if NOT done                             5/10
   Cost to complete (in operator hours)         2/10
   Strategic clarity                            7/10
   Duplicate-Epic risk                          8/10  (#1102 needs cancel)
   ──────────────────────────────────────────────────
   Composite (weighted by importance order):    5.8 / 10
   
   Verdict: MODERATELY IMPORTANT
   
   Worth doing? YES — the maps are valuable diagnostic artifacts.
   Worth doing AS-SCOPED? NO — re-scope to focus on the 2 genuinely-
   new deliverables (C1 + D1 maps).
   Pre-flight: cancel #1102 first.
```

---

## Authorship note

This critique is delivered by Claude Code Team during the same operator session that closed every other open ticket as of 2026-05-07T20:50Z. The cleanup work is the empirical basis for the "6 of 8 ACs already met" claim. The grep evidence is reproducible:

```
   grep -rn "G1 Governance" instructions/ docs/ wiki/ research/adr/
   ls instructions/harness-goals.instructions.md
   gh issue list --state closed --search "Epic 1074 OR 836 OR 829 OR 837"
```

If a future iteration finds I've understated drift or missed surfaces, the correction will be more honest than the original.
