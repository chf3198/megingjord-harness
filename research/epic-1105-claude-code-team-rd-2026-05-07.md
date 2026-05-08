# Epic #1103 — Claude Code Team Independent R&D (#1105)

**Author**: Orla Harper (claude-code:opus-4-7@anthropic, role: collaborator)
**Date**: 2026-05-07
**Ticket**: #1105 (R&D for Epic #1103)
**Status**: First-pass independent planning — Claude Code Team
**Audience**: cross-team (Copilot Team, Codex Team, public collaborators), Manager (chf3198)

This is **Claude Code Team's** parallel R&D pass for Epic #1103. It runs alongside, and does **not** reuse, `research/epic-1105-copilot-planning-package-2026-05-07.md` (Copilot Team) or other teams' artifacts. Its purpose is to give the cross-team synthesis stage three independent inputs to triangulate from.

## Contamination declaration

- **Same-session prior input from this team**: Claude Code Team authored `research/epic-1103-scope-critique-2026-05-07.md` earlier in this operator session. That artifact is *Claude Code Team's own input*. The R&D pass below corrects one factual error in that critique (see §0.2) and goes deeper on the maps it sketched.
- **Cross-team artifact awareness**: The author has READ the Copilot Team comment trail on #1105 (visible in the issue thread) but has **not** opened `research/epic-1105-copilot-planning-package-2026-05-07.md`. Independence preserved at the artifact-content level.
- **No external inputs**: no web research, no fleet-LLM consultation, no other-team artifact reads.

## §0.2 Correction to Claude Code Team's prior critique

The earlier critique stated that `instructions/harness-goals.instructions.md` is "loaded into every Claude Code / Copilot / Codex session via @-includes in CLAUDE.md, AGENTS.md, .codex/AGENTS.md, and .github/copilot-instructions.md." **This is wrong.** Verified by inspection 2026-05-07:

- `CLAUDE.md` @-includes `global-standards.instructions.md` (which carries the priority sentence inline) but does **not** include `harness-goals.instructions.md`.
- `AGENTS.md` references neither file.
- `.codex/AGENTS.md:8` carries a *paraphrased* priority sentence inline (no `G` prefixes), not an include.
- `.github/copilot-instructions.md:80-81` carries the same paraphrased sentence inline.

The expanded goal definitions in `harness-goals.instructions.md` lines 13-21 are therefore **not** part of the auto-injected runtime context for any of the three runtimes. They are reachable on demand only.

This correction itself is evidence in favor of Epic #1103: the canonical-source story is more drift-prone than the prior critique implied.

---

## §1 Goal-surface inventory (R1)

### 1.1 Surfaces carrying the priority chain (with G-prefix)

| File | Line | Form | Auto-loaded? |
| --- | --- | --- | --- |
| `instructions/harness-goals.instructions.md` | 8-9 | full G1..G9 chain + per-goal definitions L13-21 | **NO** (not @-included from runtime entry points) |
| `instructions/global-standards.instructions.md` | 34 | full G1..G9 chain (single line) | YES via `CLAUDE.md` |
| `hooks/scripts/goal_lens.py` | 8-10 | full G1..G9 chain (Python literal) | YES — UserPromptSubmit hook on goal-decision keywords |

### 1.2 Surfaces carrying the priority chain (without G-prefix)

| File | Line | Form | Auto-loaded? |
| --- | --- | --- | --- |
| `.codex/AGENTS.md` | 8 | "Governance > Quality > Zero Cost > ..." | YES (Codex runtime) |
| `.github/copilot-instructions.md` | 80-81 | "Governance > Quality > Zero Cost > ..." | YES (Copilot runtime) |
| `wiki/concepts/harness-goals.md` | 17-25 | numbered list 1..9, no G-prefix | NO (wiki concept page) |

### 1.3 Surfaces carrying *expanded goal definitions*

| File | Lines | Notes |
| --- | --- | --- |
| `instructions/harness-goals.instructions.md` | 13-21 | one line per goal |
| `wiki/concepts/harness-goals.md` | 38-46 | one line per goal — semantically same text, *separately maintained* |

### 1.4 Surfaces using goal *vocabulary* but not the priority chain

These reference individual goal terms (e.g., "Quality", "Privacy") in normal English. They are NOT drift candidates; documenting only to bound the inventory.

- `instructions/team-model-signing.instructions.md`, `instructions/release-docs-hygiene.instructions.md`, `instructions/repo-health-onboarding.instructions.md`, `instructions/sandbox-worktree-governance.instructions.md`, `instructions/visual-qa-governance.instructions.md`, `instructions/workflow-resilience.instructions.md`, `instructions/epic-governance.instructions.md`, `instructions/github-governance.instructions.md`, `instructions/readability-commenting-governance.instructions.md` — all carry vocabulary, no chain.

### 1.5 Hook configuration

- `hooks/global-standards.json` registers `goal_lens.py` as a UserPromptSubmit hook. This is the *only* path by which the canonical chain auto-injects on a goal-decision prompt.

---

## §2 Conflict / severity matrix (R2)

| Pair | Delta | Severity | Notes |
| --- | --- | --- | --- |
| `harness-goals.instructions.md` ↔ `global-standards.instructions.md:34` | identical priority sentence | none | safe |
| `harness-goals.instructions.md` ↔ `goal_lens.py:8-10` | identical | none | safe |
| `harness-goals.instructions.md` ↔ `.codex/AGENTS.md:8` | priority order identical; G-prefixes absent in Codex | **paraphrase** | benign for humans; structurally divergent for grep/lint |
| `harness-goals.instructions.md` ↔ `.github/copilot-instructions.md:80-81` | same as above | **paraphrase** | same |
| `harness-goals.instructions.md` ↔ `wiki/concepts/harness-goals.md` | priority order identical, numbered list form, definitions are separately-maintained near-duplicates | **paraphrase + duplicate definitions** | drift risk if either edited alone |
| Wiki "Always-Loaded Surfaces" list ↔ runtime reality | wiki claims `harness-goals.instructions.md` is always-loaded; runtime entry points do NOT @-include it | **factual contradiction** | medium — misleads agents and humans |
| Prior Claude Code Team critique's @-include claim ↔ runtime reality | same as above | **factual contradiction (already corrected in §0.2)** | low (now corrected) |

**Genuine contradictions**: 1 (the wiki "Always-Loaded Surfaces" claim).
**Paraphrase deltas**: 3 (Codex AGENTS, Copilot instructions, wiki concept).
**Identical**: 2 pairs.

This is a substantially-clean state. The Epic #1103 framing of "contradictory wording across surfaces" is *not* the actual risk; the actual risk is that the canonical file is **not auto-injected** anywhere except via the `goal_lens.py` keyword hook.

---

## §3 Canonical source proposal (R3)

### 3.1 Designate

`instructions/harness-goals.instructions.md` is **already** the authoritative file. Its frontmatter line 3 self-describes as "Canonical priority-ordered goals (G1-G9) and lightweight decision lens for all governed work." This designation is correct and should be preserved.

### 3.2 Required follow-on changes (no implementation in this R&D pass — these are *recommendations*)

1. **Add `harness-goals.instructions.md` to `CLAUDE.md` @-includes.** Currently absent; only its priority sentence reaches Claude sessions via the `global-standards` include.
2. **Add `harness-goals.instructions.md` to `AGENTS.md` @-includes** so Codex CLI sessions get the expanded goal definitions, not just the priority chain.
3. **Replace inline paraphrases in `.codex/AGENTS.md:8` and `.github/copilot-instructions.md:80-81`** with a back-reference to `instructions/harness-goals.instructions.md`. Or, if inline retention is preferred for Copilot/Codex bootstrap reliability, add a comment marker like `<!-- canonical: instructions/harness-goals.instructions.md -->` so lint can detect drift.
4. **Reconcile `wiki/concepts/harness-goals.md`**: either remove the duplicated definitions and link to the instruction file, OR mark the wiki copy explicitly as a derived view that a CI step regenerates from the instruction file.
5. **Fix the "Always-Loaded Surfaces" list** in the wiki concept page: drop `instructions/harness-goals.instructions.md` from that list until #1 + #2 above are merged, OR add it as a recommendation (current state is wrong).

### 3.3 Rejected alternative

Move the canonical sentence into `CLAUDE.md` / `AGENTS.md` directly (a "no separate file" approach). Rejected because the per-runtime entry-point files would then drift from each other instead of from a single source. Centralizing in `instructions/` and including-by-reference is the right shape.

---

## §4 G1..G9 → enforcement map (R4)

Each goal lists primitives that *prevent* a violation at write/merge time, plus 1-line rationale.

| Goal | Enforcement primitive | Evidence file:line |
| --- | --- | --- |
| **G1 Governance** | label-lint Rules 1-9 + E2/E3/E5; baton-gates; evidence-completeness | `.github/workflows/label-lint.yml`, `.github/workflows/baton-gates.yml`, `.github/workflows/evidence-completeness.yml` |
| G1 (cont.) | governance-audit.js (composite) | `scripts/global/governance-audit.js` |
| G1 (cont.) | epic-close-readiness | `.github/workflows/epic-close-readiness.yml` |
| **G2 Quality** | lint-readability 420-score gate + 100-line per-file ceiling | `scripts/global/lint-readability-core.js`, `scripts/lint.js` |
| G2 (cont.) | required CI: pr-title-required, lint-required | `.github/workflows/branch-name.yml`, `.github/workflows/danger.yml` |
| G2 (cont.) | quality-required gate (Stage-4 cost-quality parity) | `.github/workflows/compliance-report.yml`, `research/stage-4-cost-report-2026-05-06.json` |
| **G3 Zero Cost** | cache-hit-gate (blocks routing on cold cache) | `scripts/global/cache-hit-gate.js`, `scripts/global/cache-stats-emit.js` |
| G3 (cont.) | hamr-provider-wrapper enforces sticky-route + cacheHeaders | `scripts/global/hamr-provider-wrapper.js`, `scripts/global/sticky-route.js` |
| G3 (cont.) | cascade-dispatch (Free → Fleet → Haiku → Premium) | `scripts/global/cascade-dispatch.js`, `scripts/global/cascade-policy-overrides.js` |
| **G4 Privacy** | detect-secrets CI gate + .secrets.baseline + pre-commit hook | `.github/workflows/detect-secrets.yml`, `.secrets.baseline`, `hooks/scripts/detect-secrets-precommit.sh` |
| G4 (cont.) | dependency-review (license/CVE) | `.github/workflows/dependency-review.yml` |
| **G5 Portability** | fleet-config + devices.example.json (no-user-coupling pattern) | `scripts/global/fleet-config.js`, `inventory/devices.example.json` |
| G5 (cont.) | `MEGINGJORD_HAMR_DISABLED=1` opt-out (air-gapped) | documented in `instructions/hamr-routing.instructions.md` |
| **G6 Resilience** | header-spillover + sticky-route + graceful-degrade tests | `scripts/global/header-spillover.js`, `tests/fleet-graceful-degrade.spec.js` |
| G6 (cont.) | broker quarantine (dirty-checkout) | `scripts/global/broker.js` |
| **G7 Throughput** | anthropic-batch-router + batch-validator (50% discount, time-elastic) | `scripts/global/anthropic-batch-router.js`, `scripts/global/batch-route.js` |
| G7 (cont.) | sticky-route TTL stats + latency-routing | `scripts/global/sticky-route.js`, `scripts/global/cascade-policy-overrides.js` |
| **G8 Observability** | governance-audit.js JSON output → /tmp/governance-audit.json | `scripts/global/governance-audit.js` |
| G8 (cont.) | cost-report.js + cost-telemetry.js | `scripts/global/cost-report.js`, `scripts/global/cost-telemetry.js` |
| G8 (cont.) | wiki/log.md append-only audit | `wiki/log.md` |
| **G9 Interoperability** | broker cross-team coordination | `scripts/global/broker.js` |
| G9 (cont.) | token-provider-adapters (multi-provider table) | `scripts/global/token-provider-adapters.js` |

Every goal has ≥1 enforcement primitive. **AC-C1 of Epic #1103 is satisfiable** by extracting this table into a wiki/concepts page.

---

## §5 G1..G9 → evidence map (R5)

Each goal lists machine-readable signals that *show* compliance after the fact.

| Goal | Evidence signal | Path |
| --- | --- | --- |
| G1 Governance | issue comment trail (HANDOFF/CLOSEOUT artifacts); label-lint check status | GitHub issue events; `gh issue view N --json comments` |
| G1 | `/tmp/governance-audit.json` violations report | local artifact, `npm run governance:audit` |
| G2 Quality | Playwright test reports; lint-readability JSON | `tests/`, `logs/lint-readability*.json` (when emitted) |
| G2 | quality-parity report | `research/stage-4-cost-report-2026-05-06.json` |
| G2 | wiki eval-harness report | `logs/wiki-eval-report.json` (when emitted) |
| G3 Zero Cost | cache-stats.jsonl emit-site | `~/.megingjord/cache-stats.jsonl` |
| G3 | HAMR `/quota.hit_rate_7d` | `https://hamr.chf3198.workers.dev/quota` |
| G3 | cost-baseline + cost-report deltas | `research/stage-*-cost-report-*.json` |
| G4 Privacy | detect-secrets workflow run history | GitHub Actions runs of `.github/workflows/detect-secrets.yml` |
| G4 | `.secrets.baseline` audit count | `.secrets.baseline` (file is the evidence; PR diff shows audit decisions) |
| G5 Portability | fleet-portable-config skill walkthrough | `skills/fleet-portable-config/` |
| G5 | devices.example.json sanity | `inventory/devices.example.json` (must work without `inventory/devices.json`) |
| G6 Resilience | spillover-decision logs (header-spillover) | runtime stderr; `tests/header-spillover.spec.js` |
| G6 | graceful-degrade test evidence | `tests/fleet-graceful-degrade.spec.js` |
| G7 Throughput | batch-route receipts (`msgbatch_*` IDs) | Anthropic Batch API responses; logged via wrapper |
| G7 | latency-based-routing TTL stats | sticky-route output |
| G8 Observability | governance-audit JSON | `/tmp/governance-audit.json` |
| G8 | wiki/log.md append-only ledger | `wiki/log.md` |
| G8 | dashboard cost panels | `dashboard/js/cost-report.js` |
| G9 Interoperability | broker SQLite lease registry | `~/.megingjord/broker.db` (per Wave-1 #1083) |
| G9 | end-to-end provider adapter tests | `tests/hamr-team-integration.spec.js` |

Every goal has ≥1 evidence signal. **AC-D1 of Epic #1103 is satisfiable** by extracting this table.

---

## §6 Rollout sequence + risk register (R6)

### 6.1 Proposed child-ticket sequence (post-R&D)

| # | Effort | Description | Depends |
| --- | --- | --- | --- |
| 1 | 0.1d | Fix wiki "Always-Loaded Surfaces" claim — single-file edit to `wiki/concepts/harness-goals.md` | — |
| 2 | 0.2d | Add `@instructions/harness-goals.instructions.md` to `CLAUDE.md` and `AGENTS.md` | — |
| 3 | 0.2d | Add canonical-source back-reference markers to `.codex/AGENTS.md` and `.github/copilot-instructions.md` | — |
| 4 | 0.3d | Ship the §4 enforcement map and §5 evidence map as a wiki concept page (`wiki/concepts/harness-goal-controls.md`) | §4, §5 |
| 5 | 0.1d | Add a CI lint that detects priority-sentence drift across the 6 surfaces in §1.1+§1.2 | — |
| 6 | 0.1d | Reconcile duplicated goal definitions between `harness-goals.instructions.md` and `wiki/concepts/harness-goals.md` (single canonical, derived view) | #4 |
| **Total** | **~1.0 day** | | |

This is **half** the effort the prior critique estimated. Reason: §1's grep showed only 6 surfaces carrying the priority chain (vs. an implied "many"), and the conflict matrix surfaced just 1 contradiction + 3 paraphrases.

### 6.2 Risk register

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Adding `harness-goals.instructions.md` to `CLAUDE.md` increases session prompt by ~30 lines, which inflates token cost on every turn | high | low (G3 vs G1 tradeoff) | the file is small; alternative: keep it discoverable but not @-included, and rely on `goal_lens.py` for runtime injection |
| The CI drift-lint (Child #5) generates false positives on benign formatting differences | medium | low | start as advisory (warning, not failure) for 2 weeks; promote to hard gate after stable |
| The wiki "derived view" approach (Child #6) requires a regen script — potential for bitrot | low | low | use a simple `awk`/sed-style regen called from `npm run wiki:regen-derived`; small enough to inline |
| Operator decision needed on whether `.codex/AGENTS.md` and `.github/copilot-instructions.md` should retain the inline paraphrase (for bootstrap reliability) or back-reference (for canonical clarity) | high | medium | Manager call; flag as decision in Child #3 scope |

### 6.3 Rollback strategy

All proposed changes are pure documentation/instruction edits. Rollback is `git revert <PR-sha>` per child. No runtime behavior changes; no migration needed. Cost impact rolls back automatically with the source.

---

## §7 Where this pass differs from Claude Code Team's prior critique

| Topic | Prior critique | This R&D pass |
| --- | --- | --- |
| @-include claim | "loaded into every runtime via @-includes" | **wrong; corrected in §0.2** |
| Inventory size | "many surfaces" implied | 6 surfaces carry the chain; ~9 carry vocabulary only |
| Conflict count | "subtle drift may exist" (vague) | 1 contradiction + 3 paraphrases (precise) |
| Effort estimate | ~0.5 day | ~1.0 day (more precise; includes the @-include fix) |
| C1+D1 maps | indicative only | concrete tables with file:line evidence |

Net effect: the Epic is *less* in-flight than the prior critique implied (the maps are buildable from a single grep), but *more* worth doing than the critique implied (because the @-include gap is real and was missed).

---

## §8 Cross-team synthesis hooks

This artifact is one of three planning inputs (Claude Code, Copilot, Codex). Synthesis questions for the next round:

1. Does Copilot Team's inventory in `research/epic-1105-copilot-planning-package-2026-05-07.md` agree on the §1 surface count, or did they find surfaces this pass missed?
2. Does Codex Team have visibility into goal-language drift inside `~/.codex/` runtime artifacts that this pass didn't grep (since `.codex/AGENTS.md` is the *source*, not the deployed runtime)?
3. Is the proposed CI drift-lint (Child #5) something the operator wants advisory-first or hard-gate-first?
4. The §6.2 G3-vs-G1 tradeoff (token cost of @-including the goal file in every session) is a real decision — operator preference?

---

## §9 Authorship and reproducibility

Built from these reproducible commands (run 2026-05-07):

```bash
grep -rln "G1 Governance > G2 Quality" instructions/ docs/ wiki/ research/ hooks/ scripts/ .github/ AGENTS.md CLAUDE.md README.md
grep -rln -E "G[1-9] [A-Z]" instructions/ docs/ wiki/ research/adr/ hooks/ scripts/ .github/
grep -n "@instructions/harness-goals" CLAUDE.md AGENTS.md .codex/AGENTS.md .github/copilot-instructions.md 2>/dev/null
ls .github/workflows/*.yml scripts/global/governance-*.js
ls scripts/global/cache-*.js scripts/global/cost-*.js scripts/global/cascade-*.js scripts/global/hamr-*.js
```

A future iteration that finds I've understated drift, missed a surface, or miscounted enforcement points should correct this artifact in place.

---

Signed-by: Orla Harper
Team&Model: claude-code:opus-4-7@anthropic
Role: collaborator
