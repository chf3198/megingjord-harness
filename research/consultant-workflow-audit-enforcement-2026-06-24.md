---
wiki_type: wisdom
scope: project
content_hash: pending
last_updated: 2026-06-24
freshness_window: 30d
content_trust_score: 0.9
---

# Consultant Workflow Audit Enforcement (Epic #3235, Phase-0 #3236)

## Context

Epic #3021 Phase-1 merged with `CONSULTANT_CLOSEOUT` artifacts that passed
`consultant-gate` schema validation but skipped the substantive Consultant audit
defined in `role-consultant-critique` SKILL.md (`consultant-checks.js`,
`rubric-score.js`, L4 fleet cross-family dispatch). Epic #2093 documented the
same class of gap from #1596; it never reached Phase-1 enforcement.

**Goal:** Wire deterministic, cross-model Consultant governance drift audit into
CI for **all** agent orchestrators without weakening signer integrity or
per-ticket bypass paths.

## Method

- Live replay: `consultant-checks.js --issue 3033|3021 --json`
- Source audit: `baton-gates.yml` consultant-gate, `consultant-closeout.js`,
  `role-consultant-critique` SKILL, governance-adapters for 5 runtimes
- Portability lens: G5 tier taxonomy (#2398) — Tier-0/1 scripts vs Tier-2 HAMR
- Cross-model consensus: fleet qwen2.5-coder:7b@127.0.0.1 + corroboration

## Finding catalog

| ID | Finding | Sev×Rec | Goal | Evidence |
|----|---------|---------|------|----------|
| F-E1 | `consultant-gate` calls only `consultant-closeout.validate()` — never `consultant-checks.js` | HIGH×HIGH | G1·G2 | `.github/workflows/baton-gates.yml` L161–176 |
| F-E2 | `consultant-closeout.js` has no `checks_run`/`drift_score`/per-role grade requirements | HIGH×HIGH | G1·G2 | `megalint/consultant-closeout.js` — grep empty |
| F-E3 | L4 `cross_family_verdict` advisory only (`core.warning`) | HIGH×MED | G1·G3 | `baton-gates.yml` L177–185; Epic #2511 C3 soak |
| F-E4 | `consultant-checks` gov-002 passes when baton **comments exist** — not when CLOSEOUT embeds check output | MED×HIGH | G2 | `consultant-checks-lib.js` decideGov002; #3033 replay |
| F-E5 | Fleet/HAMR models cannot invoke `consultant-checks` (#2094) — Consultant on fleet lane is structurally thinner | MED×MED | G5·G6 | Epic #2094; `resource-tier-portability.instructions.md` |
| F-E6 | Runtime adapters omit Consultant skill contract from resident instructions | MED×HIGH | G5·G9 | `.github/copilot-instructions.md`, `.codex/AGENTS.md` — no `consultant-checks` ref; only `role-baton-routing` cites skill |
| F-E7 | Epic closeout (`CONSULTANT_EPIC_CLOSEOUT`) has no aggregated child drift audit | MED×MED | G1·G8 | #3021 closeout; no `consultant-checks` batch mode |
| F-E8 | Positive control #3029 used dual cross-family (Qwen+Llama); wave-2 self-attested only | HIGH×HIGH | G1·G3 | #3029 vs #3031–#3037 comments |

### #3021 / #3033 replay (`consultant-checks.js`)

| Issue | FAIL checks | Would block thin closeout today? |
|-------|-------------|----------------------------------|
| #3033 | fleet-001, fleet-004 (telemetry) | **No** — substantive audit gaps undetected |
| #3021 (epic) | gov-002, fleet-001, fleet-004 | **Partial** — gov-002 only if epic artifact set incomplete |

**Conclusion:** Wiring existing `consultant-checks` alone is necessary but insufficient;
new closeout-content checks (F-E2, F-E4) are required.

## Enforcement coverage matrix (4 roles × 5 lifecycle points)

| Point | Manager | Collaborator | Admin | Consultant |
|-------|---------|--------------|-------|------------|
| L1 pre-scope | skill only | — | — | — |
| L2 pre-handoff | — | cross-family **skill**; CI partial (doc-coverage) | — | — |
| L3 post-impl | — | — | admin-gate schema | — |
| L4 pre-closeout | — | — | — | **schema only**; checks skill-only |
| L5 epic close | EPIC_RESCOPE skill | — | — | EPIC_CLOSEOUT schema only |

**CI hard gates today:** collaborator (partial), admin (signer), consultant (thin schema).
**Missing:** Consultant substantive audit + L4 fleet dispatch proof.

## Portability across orchestrators (G5 focus)

Design principle: **enforce at Tier-1 CI** (GitHub PR gate — identical for every
team) and **assist at Tier-0 CLI** (same script every runtime invokes pre-closeout).
Never require Tier-2 HAMR for baseline compliance.

| Runtime | Adapter / deploy | Invokes audit CLI | Resident contract | Deploy cmd |
|---------|------------------|-------------------|-------------------|------------|
| Copilot | `.github/copilot-instructions.md` + `~/.copilot/skills/` | Yes (terminal) | `role-consultant-critique` global skill | `npm run deploy:apply` |
| Claude Code | `CLAUDE.md` + `~/.claude/skills/` | Yes | on-demand via `role-baton-routing` | `npm run deploy:claude:apply` |
| Codex | `.codex/AGENTS.md` + `~/.codex/devenv-ops/` | Yes | on-demand only | `npm run deploy:apply` |
| Cursor | `.cursor/rules/megingjord.mdc` + global skills | Yes | Megingjord rule + skills | `npm run deploy:cursor:apply` |
| Antigravity | `.antigravity/` + `generated/governance-adapters/antigravity/` | Yes | `cross-family-review` cmd only | adapter regen + deploy |

**G5 gaps today:** F-E6 (no resident `consultant-checks` in any adapter);
F-E5 (fleet Consultant cannot run gh-backed checks without #2094 HAMR tool).

**Remediation (C3+C5+C6):**

1. `consultant-closeout-run.js --issue N [--json]` — Tier-0/1; wraps
   `consultant-checks` + `rubric-score` + `cascade-dispatch` L4; stdout = CLOSEOUT block.
2. `governance-adapters` generator emits `consultant-audit.instructions.md` into
   **all five** targets (copilot, claude-code, codex, cursor, antigravity).
3. `MEGINGJORD_HAMR_DISABLED=1` → L4 uses direct Ollama (already works); checks
   still run locally — no orchestrator skip path.
4. HAMR `tool:consultant-audit` (C6) pre-computes checks JSON when agent has no shell.

**External alignment:** 2026 industry shift to CI/MLOps-embedded governance gates
(Microsoft Agent Governance Toolkit; OWASP Agentic Top 10 runtime controls) —
Megingjord's baton-gates pattern is architecturally aligned; gap is Consultant
substance not framework choice.

## Promotion ladder (advisory → blocking)

| Step | Change | Rollback |
|------|--------|----------|
| P0 | `consultant-closeout-run.js` CLI + skill update | N/A (additive) |
| P1 | Gate runs `consultant-checks`; FAIL → advisory 2 weeks | `CONSULTANT_CHECKS_GATE_ADVISORY=1` |
| P2 | Require `checks_run`/`checks_failed` in CLOSEOUT schema | revert schema field |
| P3 | L4 `cross_family_receipt` blocking + dispatch log bind | `GATE_ADVISORY_MODE=1` |
| P4 | Dual-family corroboration on epic closeouts | advisory second opinion |

## Phase-1 child decomposition (for Manager after consensus)

| Child | Scope | Portability note |
|-------|-------|------------------|
| C1 | `consultant-gate` invokes checks; advisory→blocking flag | CI — all teams |
| C2 | Extend `consultant-closeout.js` + `consultant-checks` gov-008..010 | Tier-1 |
| C3 | `consultant-closeout-run.js` orchestrator CLI | All runtimes |
| C4 | Promote L4 cross-family to blocking (#2511 C3 exit soak) | Fleet + free-cloud |
| C5 | `governance-adapters` + deploy manifests — resident Consultant contract | G5 |
| C6 | HAMR `tool:consultant-audit` (#2094 alignment) | Tier-2 fallback |
| C7 | Epic batch mode: `consultant-checks --epic N` | Epic closeouts |
| C8 | Regression fixtures: thin #3021 FAIL / #3029 PASS | CI |

## Reconciliation

- **#2093** → fold AC-1..4 into C1–C2; close #2093 when C1 ships
- **#2095** → superseded by this deliverable; close #2095
- **#2511** → C4 completes C3 promotion
- **#3069** → review *quality*; orthogonal to enforcement wiring
- **#2094** → C6 fleet tool parity

## Goal-lens (draft)

G1:10 G2:9 G3:10 G4:9 G5:10 G6:9 G7:9 G8:8 G9:10 — min=8, mean=9.3

## External references (2026)

- Microsoft Agent Governance Toolkit — runtime/CI policy enforcement (Apr 2026)
- OWASP Agentic AI Top 10 — identity abuse (OA3) / rogue agents (OA6)
- Kore.ai / Obot.ai — CI-embedded governance vs document-only policy

Signed-by: Cursor Manager  
Team&Model: cursor:composer-2.5-fast@cursor-ide
