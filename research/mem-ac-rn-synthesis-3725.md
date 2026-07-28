---
title: "AC-Rn — Synthesis: target memory architecture + prioritized Phase-1 backlog"
ticket: 3725
epic: 3724
lane: docs-research
ac: AC-Rn
last_updated: 2026-07-10
status: ratified
cross_family_receipt: 98d60bb3aa3842c0
related:
  - "[[mem-surface-inventory-3725]]"
  - "[[mem-ac-r1-taxonomy-3725]]"
  - "[[mem-ac-r2-temporal-3725]]"
  - "[[mem-ac-r3-consolidation-forgetting-3725]]"
  - "[[mem-ac-r4-context-budget-3725]]"
  - "[[mem-ac-r5-privacy-scope-3725]]"
  - "[[mem-ac-r6-retrieval-eval-3725]]"
  - "[[mem-ac-r7-write-path-3725]]"
---

# AC-Rn — Synthesis & Phase-1 backlog

## Ratified target memory architecture (one coherent system)

The harness memory system is **evolved, not rebuilt** (Epic #3719 lesson). One spine, four layers, all $0/deterministic, no vector/graph DB, index-first floor preserved:

1. **Taxonomy spine (AC-R1).** Every record carries a `memory_class:` (`working|episodic|semantic|procedural`) **derived from `memory-write-router.js` factClass** + a human-facing `type:`. Stores are *relabelled*, not re-homed: A=procedural, B=episodic, C=semantic, context=working.
2. **Temporal layer (AC-R2).** Fact-bearing records gain nullable `valid_from`/`valid_to`; **close-don't-overwrite** supersession (`status: superseded` + `superseded_by`); transaction time is free from git; `freshness_window` retired. Contradiction detection is agent-in-loop at edit time.
3. **Lifecycle layer (AC-R3).** The #3380 classifier becomes **5 destinations** (+`episodic`) with an **episodic→semantic|procedural consolidation edge** (batch idle/sleep-time, importance-triggered, supersedes sources) and **deterministic forgetting** (TTL + LRU/recency/frequency decay + supersession-on-write; **archive, never hard-delete**). Fail-open-to-semantic preserved.
4. **Budget & retrieval layer (AC-R4 + AC-R6).** A resident-token **budget** (`MEMORY.md` thin index ≤200 lines/25KB) + retrieval-on-demand via `read-router.js` (top-k, dedupe, head/tail placement); a **file-native LongMemEval⊕FAMA eval** (retrieval + answer + forgetting-absence) reusing replay-eval, promotion-gated at precision ≥0.85.
5. **Privacy & durability substrate (AC-R5 + AC-R7, hard constraints).** Named **3-tier contract** (`tier:`+`visibility:`), **one-way redaction-gated promotion lattice** (fail-closed), **A4 scope-isolation-lint**, most-restrictive-scope inheritance; Wiki B durability via a **non-protected `wiki-mirror` branch** (Option b) — **never** a branch-protection bypass actor (client-only carve-out).

**Load-bearing invariants (may not weaken):** log-redaction, A4 isolation, private/global split, branch-protection on `main`, fail-open-to-semantic, archive-not-delete, index-first $0 floor.

## Prioritized Phase-1 backlog (each child cites its Phase-0 sources)

Ordered by goal-lens (G1 Governance > G2 Quality > G3 Zero-Cost > **G4 Privacy** > … > G10) **and** dependency. G4 + foundational-taxonomy first; validation harness early (it gates every later promotion).

| # | Phase-1 child | Priority | Depends on | Phase-0 sources | Goal driver |
|---|---|---|---|---|---|
| **P1-A** | Memory taxonomy: `memory_class:` frontmatter + write-router `factClass→memory_class` column + relabel lint | **P1** | — (foundational) | AC-R1 (#3725) | G10, G1 |
| **P1-B** | Privacy-tier contract: `tier:`/`visibility:` frontmatter + one-way redaction-gated promotion + `scope-isolation-lint` (A4) | **P1** | P1-A | AC-R5, AC-R1 | **G4** (hard), G1 |
| **P1-C** | Wiki B durability write-path: `wiki-mirror` non-protected branch cutover; coordinate exec with #3719/#3723 | **P1** | — | AC-R7, AC-R5 | G1/G4 + G6 (unfreezes frozen store) |
| **P1-D** | Memory eval harness (LongMemEval⊕FAMA: retrieval+answer+forgetting-absence) reusing replay-eval | **P2** | P1-A | AC-R6, AC-R2 | G2 (gates all later promotions) |
| **P1-E** | Temporal validity: `valid_from`/`valid_to` + close-don't-overwrite + current-view router filter + retire `freshness_window` | **P2** | P1-A, P1-D | AC-R2, AC-R6 | G2 |
| **P1-F** | Lifecycle: 5-dest classifier + episodic→semantic consolidation + deterministic forgetting (archive-not-delete) | **P2** | P1-A, P1-E | AC-R3, AC-R1, AC-R2 | G2, G3 |
| **P1-G** | Context budget: `mem-budget-lint` + retrieval-on-demand residency + extend #3137 split to memory + G8 token gauge | **P3** | P1-A, P1-D | AC-R4, AC-R6 | G3, G8 |

Dependency DAG: `P1-A → {P1-B, P1-D}`; `P1-D → {P1-E → P1-F, P1-G}`; `P1-C` independent (durability). **P1-C is the only one with immediate operational payoff (unfreezes Wiki B)** so it runs in parallel with P1-A/P1-B.

## Explicit deferred scope (not Phase-1)
- Vector/graph retrieval & automatic contradiction detection — **DEFERRED behind the P1-D eval** (promote only if the keyword floor underperforms at precision ≥0.85). (AC-R2, AC-R6)
- KV-cache/token-level demand paging — deferred; markdown store gets *behavioural* demand-paging only. (AC-R4)
- Option (a) bypass-actor & any branch-protection weakening — **retained client security carve-out**, never auto-taken. (AC-R7)
- Tiers 2/3 cross-workspace memory sync — out of scope (Tier-1 workspace is the case). 

## Cross-family ratification
Each AC-R1..R7 passed an independent $0 cross-family panel (meta+mistral, non-authoring). This synthesis is ratified by a terminal panel (receipt in frontmatter / #3725 comment). Consultant gate: `min(G1..G9) ≥ 7`.

## Decision log (G8)
- 2026-07-10 — Synthesis ratifies the 5-layer evolve-not-rebuild architecture + 7-child prioritized Phase-1 backlog with an explicit deferred-scope list. Cross-family panel: receipt above.
