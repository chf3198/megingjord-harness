---
title: "Phase-0 — Governance-surface debt: baseline + repair design"
type: wisdom-project
content_trust_score: 0.9
created: 2026-07-17
updated: 2026-07-17
scope: project
status: phase-0
tags: [governance, friction, epic-3807, measurement, self-anneal]
---

# Phase-0 synthesis — reverse governance-surface debt (Epic #3807, child #3808)

Research-first Phase-0 for making the harness self-pruning and affordance-first. The parent
diagnosis: the governance surface is **append-only** — every incident adds a detector and nothing
is retired, so the control plane grows monotonically and taxes every turn. This Phase-0 delivers the
**measurement backbone** (a re-runnable census, committed as a baseline) and the **repair design**.

## 1. Baseline census (t=0, measured — not estimated)

Tool: `scripts/global/governance-surface-census.js` (READ-ONLY). Snapshot:
`governance/surface-census-baseline.json`. Re-run any time; `--baseline <snap>` prints the Δ.

| Surface | Count | Note |
|---|---|---|
| **surface_units** (invariant headline) | **158** | validators + resident-instruction files + bypass flags |
| Validators (megalint) | 56 | **26 advisory / 30 blocking** |
| CI workflows | 110 | |
| Hooks (py) | 63 | |
| Skills | 42 | |
| Global scripts | 671 | |
| Tests | 820 | |
| **Resident** instructions | **21 files / 2,335 LOC** | always-on set (`CLAUDE.md` + its `@`-imports) |
| Instruction corpus (total) | 44 files / 4,315 LOC | resident + on-demand |
| Bypass / override flags | 81 | distinct, de-duplicated |

**Correction the census already produced (why measurement-first matters):** the parent teardown
cited "4,238 LOC always-resident." The census, which distinguishes `@`-imported always-resident
files from the on-demand set (Epic #3137 split), shows the true always-resident load is **2,335 LOC
across 21 files** — the other ~1,980 LOC is already on-demand. The rough grep also over-counted
bypass flags (94 → 81 de-duplicated). The scoreboard corrected two headline numbers on its first
run. This is the point of the invariant: decisions ride on measured counts, not memory.

## 2. Outcome-telemetry design (measure outcomes, not sentiment)

Per METR (`arXiv:2507.09089` — devs 19% slower but *felt* 20% faster) and DORA 2025 (the
"verification tax"), felt-friction is an unreliable signal. The Epic tracks **outcomes**:

- **Net-surface Δ** — `census --baseline` before/after each retirement; the AC-E4 invariant.
- **Recurrence rate** — per-`pattern_id` incidents/week from `incidents.jsonl` (is a fixed friction
  actually decaying after its affordance ships?).
- **Verification tax proxy** — governance comments + baton artifacts per merged PR (ceremony per
  unit of change; the #3576 concern, quantified).
- **Bypass-flag usage** — existing `it-ops:usage-report` / `routing:fallback-report` pattern, extended.

All are $0, derived from committed logs; no new always-resident surface.

## 3. Gate disposal-path contract (the missing half of promotion)

Today gates ship advisory and *promote* to blocking on replay-eval ≥ 0.85. There is **no demotion or
deletion path**, so 26/55 sit advisory indefinitely — full maintenance cost, no protection. The
contract to add (Phase-1 C3):

- **Demote/delete trigger:** an advisory validator that has NOT promoted after N eligible replay-eval
  windows AND whose replay-eval precision is < floor is a *retirement candidate* — flagged, not
  auto-deleted.
- **Retirement is itself replay-eval-gated** (symmetry with promotion; never calendar-based) and
  **cross-family-verified** before removal.
- **Reversible:** deletion is a git revert away; the census snapshot proves the before/after.
- **Never auto-retire a G1/G4 gate** — that is the security-weakening human touchpoint (see §6).

## 4. Resident-load budget model (mechanism 4)

- Treat always-resident LOC as a **budget** (baseline 2,335). A new resident rule must either fit the
  budget or displace an existing one (net-zero-or-negative).
- Deepen the on-demand split (`instructions-split-classifier.js`) — migrate resident rules with no
  always-on binding signal to on-demand. Coordinate with #3724 (memory mechanisms), do not duplicate.
- IFScale (`arXiv:2507.11538`, 68% ceiling + primacy bias) + Chroma context-rot are the evidence the
  budget protects compliance, not just tokens.

## 5. Correctness ≠ reachability contract (mechanism 5 / the receipt-gate case study)

A correctness gate coupled to volatile external state (the cross-family receipt needing ≥2 live cloud
families) must **degrade honestly**: report `cannot-verify` (a visible non-pass), never hard-block
completed work as though it *failed*. Generalize the pattern: any gate whose input is external
liveness gets a `reachable?` pre-check distinct from its `pass?` check; unreachable → advisory
degrade + operator-visible signal, not a red block. (The fleet-backed receipt widening from #3126/
#3803 is the substrate that makes the receipt gate reachable in the first place.)

## 6. De-confliction map (coordinate, do not duplicate)

| Ticket | Owns | This Epic adds |
|---|---|---|
| #3576 (dormant) | ceremony-weight right-sizing; activating dormant lanes/tiering; `#3586` credit/free-tier observability | the *reframe* + the net-surface invariant + disposal path; consumes #3586 as a telemetry feed |
| #3656 (backlog) | local-preflight ↔ CI parity (shift-left of *format* errors) | the broader affordance-over-detection reframe + typed-tool conversions; cites #3656, no overlap |
| #3724 (dormant) | memory-mechanism refinement | resident-instruction *budget* + prune pass; coordinate, one owner per file |
| #3380 (closed) | the friction→guardrail classifier | re-aims that reflex toward affordance + disposal; extends #3380's anti-bloat intent to the guardrail surface it grew |

## 7. Cross-model-validated Phase-1 slate (each names what it RETIRES)

| Child | Adds | Retires (net-negative contribution) | Risk |
|---|---|---|---|
| **C1 Measurement backbone** | census (shipped here) + telemetry emitters | — (measurement is the enabler) | none (read-only) |
| **C2 Affordance-first #1 class** | free-fleet path as a default/wired affordance | the redundant raw-fleet redirect sensor(s) once recurrence decays | low |
| **C3 Gate disposal path** | demotion/deletion contract + tooling | advisory validators that fail retirement-eval (cross-family-verified) | med — gated |
| **C4 Resident-load budget** | budget check + prune pass | superseded/duplicated resident instruction LOC | low |
| **C5 Correctness≠reachability** | honest-degradation wrapper | over-tight bypass flags made unnecessary | low |
| **C6 Shift-left conversions** | typed tool/output-schema constraints | N validators whose property becomes unemittable | med — cross-family-verified |

**Net-negative math:** C2/C3/C4/C5/C6 each retire ≥1 surface unit; C1 adds 1 script (not a governed
gate) + the census baseline. Target: `Δ surface_units ≤ 0` at Epic close, evidenced by re-running the
census. Any child that cannot retire without weakening a G1/G4 control **escalates to the human**
(security-weakening carve-out) rather than forcing the number.

## 8. Catastrophe-precautions (binding on all Phase-1 work)

1. **Measure → verify → cut, never cut blind.** Every retirement re-runs the census and cites the Δ.
2. **Reversible only.** Deletions land as isolated commits; a git revert restores the gate.
3. **Cross-family verify every retirement** — a $0 panel must agree the removed surface is dead/redundant and no control is weakened.
4. **Never autonomously retire a G1 (Governance) or G4 (Privacy/Security) gate** — escalate; that is a retained human touchpoint.
5. **One retirement per PR** — small, isolated, individually revertible; no batch removals.

## References
- Parent Epic #3807; teardown artifact (2026-07-17); IFScale `arXiv:2507.11538`; Chroma Context Rot (2025);
  Self-Correction Bench `arXiv:2507.02778`; METR `arXiv:2507.09089`; golden-path (platformengineering.org).
