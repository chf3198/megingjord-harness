# Cross-Family Review Contract — #2511 Phase-0

Parent Epic: #2511
Date: 2026-05-31
Status: ACCEPTED — iter-3 fleet review complete (AC-R4) — G1=90,G2=85,G4=90,G5=80,G8=80,G9=75,G10=85,G7=65(intentional)
wiki_type: wisdom
scope: project
last_updated: 2026-05-31
freshness_window: 30d

---

## 1. Problem Statement

Every Consultant closeout in sessions reviewed 2026-05-31 was signed by
`copilot:claude-sonnet-4-6@github` — the same family that performed Manager,
Collaborator, and Admin work. The harness has partial cross-family obligations
scattered across Epic #2192, Epic #2414, and individual tickets (#2438, #2439,
#2510), but no single canonical document defines the full obligation.

## 2. Definitions

**AI family**: the vendor/lineage of a model, not the specific version.
- Family Anthropic: `claude-*`
- Family OpenAI: `gpt-*`, `o1-*`, `o3-*`, `o4-*`
- Family Qwen (Alibaba): `qwen*`
- Family DeepSeek: `deepseek-*`
- Family Granite (IBM): `granite-*`

**Cross-family requirement**: the reviewing model's family MUST differ from the
implementing role's family. Same-family review is self-review.

**Enforcement tier**:
- **Hard-gate (H)**: CI/validator blocks merge/close. Model-capability-independent.
- **Pre-commit (P)**: local hook blocks push.
- **Advisory (A)**: warning only; does not block.
- **N/A**: not applicable.

## 3. The Five Lifecycle Points

| ID | Name | Event |
|---|---|---|
| L1 | Pre-implementation | Before first file write on ticket branch |
| L2 | Pre-COLLABORATOR_HANDOFF | Collaborator self-gate before emitting handoff |
| L3 | Admin receipt | Admin validates Collaborator CF evidence on pickup |
| L4 | Pre-CONSULTANT_CLOSEOUT | Consultant independent cross-family critique |
| L5 | Retrospective | Post-merge Tier-2 anneal on repeated same-family pattern |

## 4. Coverage Matrix — 4 Roles × 5 Lifecycle Points

### 4.1 Manager

| Lifecycle | Obligation | HOW | Enforcement | Ticket |
|---|---|---|---|---|
| L1 | None — sets scope | N/A | N/A | — |
| L2 | N/A | N/A | N/A | — |
| L3 | N/A | N/A | N/A | — |
| L4 | N/A | N/A | N/A | — |
| L5 | Tier-2 anneal if ≥2 sessions show same-family pattern | `workflow-self-anneal` | A | #2356 AC5 (partial) |

### 4.2 Collaborator

| Lifecycle | Obligation | HOW | Enforcement | Ticket |
|---|---|---|---|---|
| L1 | Optional orientation check | `collaborator-preflight.js --pre-impl` | A | — |
| L2 | **REQUIRED**: cross-family fleet review; include `cross_family_rating`, `cross_family_reviewer`, `cross_family_findings` in COLLABORATOR_HANDOFF | `npm run collaborator:preflight` → `fleet-red-team-dispatch.js` | **P+H** | #2438, #2439 |
| L3 | N/A | N/A | N/A | — |
| L4 | N/A | N/A | N/A | — |
| L5 | N/A | N/A | N/A | — |

**Standard**: ≥7B Qwen/DeepSeek/Granite/OpenAI non-Anthropic model. Minimum pass: 80/100 (G2-aligned).
Fleet-first (G3): 36gbwinresource then OpenClaw before paid providers.
**Fallback (G5)**: if no ≥7B fleet node is available, 3B model at 60/100 advisory-only; gate demotes to advisory until ≥7B restored.
**Quality criteria (G2)**: passing review MUST include per-section feedback and ≥1 concrete gap or risk; generic scores alone are insufficient.

### 4.3 Admin

| Lifecycle | Obligation | HOW | Enforcement | Ticket |
|---|---|---|---|---|
| L1 | N/A | N/A | N/A | — |
| L2 | N/A | N/A | N/A | — |
| L3 | **REQUIRED**: verify `cross_family_reviewer` family ≠ Collaborator `Team&Model` family before ADMIN_HANDOFF | `admin-handoff.js` extended family check | **H** | #2510 |
| L4 | N/A | N/A | N/A | — |
| L5 | N/A | N/A | N/A | — |

**Family-independence check**: extract family from `cross_family_reviewer` field
vs. Collaborator signer family. Reject ADMIN_HANDOFF if families match.

### 4.4 Consultant

| Lifecycle | Obligation | HOW | Enforcement | Ticket |
|---|---|---|---|---|
| L1 | N/A | N/A | N/A | — |
| L2 | N/A | N/A | N/A | — |
| L3 | N/A | N/A | N/A | — |
| L4 | **REQUIRED**: Consultant family ≠ Collaborator AND Admin signer families; include `cross_family_verdict:` in CONSULTANT_CLOSEOUT | `fleet-red-team-dispatch.js`; `signer-fidelity.js` family check | **H** | Epic #2192 (research-first; **GAP: bridge needed**) |
| L5 | N/A | N/A | N/A | — |

**Verdict field**: `cross_family_verdict: <ACCEPT|PARTIAL|REJECT> — <model@host> — <rationale>`

## 5. Reconciliation — Existing Tickets vs. Contract

| Contract cell | Ticket | Coverage | Gap |
|---|---|---|---|
| Collaborator L2 schema | #2439 | Full (queued) | None |
| Collaborator L2 preflight | #2438 | Full (queued) | None |
| Admin L3 family check | #2510 | Full (backlog) | None |
| Consultant L4 hard gate | Epic #2192 | Partial — research-first, Phase-0 not started | **Bridge gate needed** |
| Consultant L4 signer-family check | None | **MISSING** | New child: extend `signer-fidelity.js` |
| Canonical instructions update | None | **MISSING** | New child: `instructions/cross-family-review.instructions.md` |
| Canonical invocation skill | None | **MISSING** | New child: `skills/cross-family-review/SKILL.md` |
| baton-gates.yml Consultant CF gate | None | **MISSING** | New child: bridge gate |

**Epic #1899** (adversarial review skill): complementary tool layer; not duplicative.
**Epic #2509** (decision oracle): orthogonal; fleet-decision-oracle for Y/N ops choices, not quality critique.

## 6. Phase-1 Child Slate

| ID | Title | Files touched | Priority |
|---|---|---|---|
| C1 | Extend `signer-fidelity.js`: family-level check for Consultant | `scripts/global/megalint/signer-fidelity.js` | P1 |
| C2 | Add `cross_family_verdict:` to CONSULTANT_CLOSEOUT schema + validator | `scripts/global/megalint/consultant-closeout.js` | P1 |
| C3 | Bridge Consultant CF hard gate in `baton-gates.yml` | `.github/workflows/baton-gates.yml` | P1 |
| C4 | Create `instructions/cross-family-review.instructions.md` | `instructions/` | P1 |
| C5 | Create `skills/cross-family-review/SKILL.md` | `skills/` | P2 |
| C6 | Coordination: harmonize #2438/#2439 output fields with C2 schema | comment on #2438/#2439 | P1 |

Existing children fully scoped (no changes): #2438, #2439, #2510, #2437.

## 7. Enforcement Ladder

```
Pre-commit (P):
  collaborator-preflight.js: cross-family fleet review step blocks push if absent

CI Hard-gates (H) — baton-gates.yml:
  collaborator-gate: cross_family_rating + cross_family_reviewer + cross_family_findings
  admin-gate: cross_family_reviewer family != Collaborator Team&Model family
  consultant-gate: cross_family_verdict present; Consultant family != Collaborator family

Advisory (A):
  workflow-self-anneal Tier-2: triggered when same-family pattern repeats ≥2 sessions
```

## 8. Privacy & Maintainability (G4, G10)

**G4 Privacy**: Fleet dispatch MUST NOT include secrets, credentials, or PII.
Use redaction patterns from `config/redaction-patterns.json` before dispatching
any code content. Fleet nodes operate on a private Tailscale network
(RFC-1918 equivalent), satisfying the G4 "secrets local" requirement. No
cross-family review content is routed through public cloud endpoints.

**G10 Maintainability**: New model families are added to section 2 Definitions
via a new child ticket (≤1 PR). This document is updated through the standard
PR+ticket pipeline. Each Phase-1 child is ≤100 lines. The enforcement ladder
(section 7) is settings-driven (advisory flags via env vars) to support
low-friction updates as requirements evolve.

## 9. Cross-Runtime Scope (G9) & Observability (G8)

This contract applies equally to Copilot, Codex, and Claude Code runtimes.
Runtime differences (fleet availability, hook activation) are handled by the
G5 fallback and advisory tiers. No runtime is exempt from cross-family independence.

**G8 Observability**: `cross_family_verdict:` records from CONSULTANT_CLOSEOUT
are appended to `incidents.jsonl` (category `cross-family-audit`) after merge,
enabling Tier-2 anneal (L5) to detect repeated same-family patterns. C3 bridge
gate wires this append step.

## 9. Open Questions — Resolved (AC-R4 Iteration 1)

Q1 → **RESOLVED**: Any non-matching family is sufficient (no Manager whitelist required).
Q2 → **RESOLVED**: 80/100 minimum (red-team iter-1 confirms G2 alignment).
Q3 → **RESOLVED**: Advisory initially; time-gated promotion to blocking per Tier-B++ pattern.
Q4 → **RESOLVED**: Keep #2192 separate; C3 bridge gate is lightweight dependency, not absorption.

---
Signed-by: Soren Harper
Team&Model: copilot:claude-sonnet-4-6@github
Role: collaborator
Refs #2511
