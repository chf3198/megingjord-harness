# Epic-Creation Standard — Reconciliation & Phase-1 Plan

> Companion to [governance-epic-creation-standard.md](governance-epic-creation-standard.md). Phase-0 evidence
> for Epic #3255 (gate #3256): proves the residual is non-redundant, and specifies the single Phase-1 ticket.

## 1. Reconciliation — original #3255 scope → shipped vs residual

| # | Original #3255 scope item | Status | Shipped by / residual |
|---|---|---|---|
| 1 | Research-first single-gate + `EPIC_RESCOPE` + Phase-1-cites-Phase-0 + re-arm rules **documented** | ✅ shipped | [`instructions/epic-governance.instructions.md`](../instructions/epic-governance.instructions.md) → "Research-First Epic Phase Gate" |
| 2 | **Validator** detecting malformed research-first Epics (missing gate, bad transition) | ✅ shipped | [`scripts/global/megalint/research-first-phase-gate.js`](../scripts/global/megalint/research-first-phase-gate.js) |
| 3 | Guard blocking Phase-1 promotion before Phase-0 closes | ✅ shipped | [`scripts/global/phase0-closure-guard.js`](../scripts/global/phase0-closure-guard.js), [`scripts/global/megalint/phase0-promotion-gate.js`](../scripts/global/megalint/phase0-promotion-gate.js) |
| 4 | Phase-1 → Phase-0 AC traceability check | ✅ shipped | [`scripts/global/megalint/epic-ac-traceability.js`](../scripts/global/megalint/epic-ac-traceability.js) |
| 5 | Over-decomposition / idle-child drift detection | ✅ shipped | [`scripts/global/lint-epic-drift.js`](../scripts/global/lint-epic-drift.js) |
| 6 | **Creation-by-default scaffold** — produce a compliant Epic (labels + single R&P gate + JIT wiring) by default | ❌ **residual** | `ticket-create.js` is generic (`Type (epic\|story\|task\|bug\|doc)` only); `gov-scaffold-link.js` scaffolds chain-links, not Epics |
| 7 | **Cross-team creation standard-of-record** | ❌ **residual** | the companion standard doc |
| 8 | Cross-team portability of the scaffold (Tier-1 floor: local + GitHub) | ❌ **residual** | folds into #6 |

**Result:** items 1–5 are done (rebuilding them = redundant + conflict risk against canonical validators);
items 6–8 are the genuine, non-redundant Phase-1.

## 2. Phase-1 enforcement plan (the residual) — SHIPPED (#3713)

> **Status:** SHIPPED via `scripts/global/epic-scaffold.js` (+ `epic-scaffold-cli.js`), Epic #3255 Phase-1 (#3713). The composition acceptance gate below is enforced as a round-trip test.

**One** implementation ticket (no sprawl), specified so Phase-1 is provably non-redundant:

- **`scripts/global/epic-scaffold.js`** — pure-logic + thin `gh` CLI wrapper that, from
  `--title/--area/--priority`, emits a research-first **Epic** body + correct label set, and **exactly one**
  R&P child (`type:research` + `phase-gate:research-first` + `lane:docs-research`), linked as a sub-issue, with
  the `min(G1..G9) ≥ 7` + `EPIC_RESCOPE` gate stated in its body.
- **Cross-team portability:** pure-logic core (unit-testable, no network) + a runtime-agnostic CLI so Copilot,
  Codex, and Antigravity invoke the identical scaffold — the single source of "how an Epic is born."
- **Explicitly out of scope:** any new validator (already shipped); ticket *supersession* detection (that is
  #3398's surface, not this Epic's).

## 3. Composition acceptance gate (hard, testable — closes the reviewer-flagged top risk)

The single consistently-raised cross-family risk is that a creation scaffold could **drift from or duplicate**
the canonical validators. Neutralised by making composition a **blocking** acceptance condition on Phase-1:

1. **Round-trip test (blocking):** `epic-scaffold.js` output (Epic + R&P child body/labels) is fed verbatim
   into `research-first-phase-gate.js` and `epic-ac-traceability.js`; both MUST return `ok:true`, zero
   violations. A scaffold whose own output fails the canonical validators fails CI — the validators stay the
   single source of truth; the scaffold is a *pre-satisfier*.
2. **No-new-rule assertion:** the Phase-1 PR MUST NOT add or modify any file under `scripts/global/megalint/`
   or the `phase0-*` guards (path-scope check). The scaffold may only *produce* structures the rules accept.
3. **Observability (G8):** the scaffold emits a one-line provenance record (`epic-scaffold: created #E + gate
   #G, validators=pass`) to the standard governance log surface — auditable without new infrastructure.
4. **Zero-cost (G3):** scaffold is pure-logic + `gh` CLI only — no model calls, no paid dependency.
