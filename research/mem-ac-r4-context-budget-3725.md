---
title: "AC-R4 — Context budget: minimize always-resident tokens, resist context rot"
ticket: 3725
epic: 3724
lane: docs-research
ac: AC-R4
last_updated: 2026-07-10
status: ratified
cross_family_receipt: c7a471baa47f2b75
related:
  - "[[mem-surface-inventory-3725]]"
  - "[[mem-ac-r6-retrieval-eval-3725]]"
---

# AC-R4 — Context budget & context-rot resistance

## Question
Minimize always-resident token cost (`MEMORY.md`, resident instructions per #3137) and specify a retrieval-on-demand / context-compression policy that resists context-rot as memory grows.

## As-is
`MEMORY.md` is an index resident **every session**; the harness already has partial mitigation — Epic **#3137** splits instructions into resident vs on-demand (`instructions-split-classifier.js`, fail-open: any binding signal → resident), and **`read-router.js`** makes index-first + grep the $0 floor with heavy sweeps delegated to a sub-agent returning a **1–2K digest** (keeps big reads out of the main window) + a `recallMiss()` **G8** canary. So the retrieval-on-demand spine exists; what's missing is a **token budget** and a **rot-aware residency policy**.

## SOTA evidence
- **Context rot** (Chroma, Jul 2025): 18 frontier models, 1K→1M tokens — **every model degrades as input grows; none holds flat**. Degradation ≠ overflow (a 200K model degrades well before 200K). A task perfect at ~100 tokens can fail at ~1,000; **even a single distractor** lowers accuracy vs needle-only.
- **Lost-in-the-middle** (Liu et al.): U-shaped curve — best recall at **head/tail**, **~30pt drop** when the answer sits at position 10 of 20; Chroma corroborates positions **5–15 of 20** are the "death zone."
- **Token economics:** production agents are **input-compute-bound** — a 10-tool-call ReAct loop can emit ~500 output tokens while consuming ~800K input; the case for retrieval-on-demand over always-resident. Three-tier consensus: T1 in-context working (lossless) / T2 compressed session summary / T3 external persistent. Demand-paging for context (arXiv **2603.09023**): treat tokens as pages, keep only the working set resident, page-fault + LRU-evict cold tokens.

## Decision (recommended)
1. **Explicit resident-memory token budget.** Set a hard cap on the always-resident memory surface (`MEMORY.md` index + resident instructions) — target the Claude Code auto-memory documented behaviour (first **200 lines / 25KB of `MEMORY.md`**, topic files on demand) as the ceiling; a lint (`mem-budget-lint`) warns when the index exceeds it. Consolidation (AC-R3) is the pressure-relief valve that keeps it under budget.
2. **`MEMORY.md` stays a thin, compressed index** (titles + one-line pointers — already its shape); **never** inline full memory files. Page in individual notes on demand via the existing `read-router.js` keyword/frontmatter route (top-k, e.g. 3–5, Voyager-style cap), dedupe distractors before injection (a single distractor measurably degrades recall).
3. **Rot-aware placement.** Keep the resident index small enough to sit in high-recall **head/tail** positions; put the most critical always-on directives at the very top/bottom, never buried in the 5–15/20 death zone.
4. **Extend #3137 to memory.** The instructions-split classifier's resident/on-demand split is the model; apply the same "binding signal → resident, else on-demand" test to memory records (core identity/`user` directives resident; episodic/project notes on-demand).
5. **Observe, don't guess (G8).** `recallMiss()` already emits a canary; add a resident-token-budget gauge to the same schema-v3 surface so over-budget is *observed, not silent*.

## Tradeoffs / non-goals
- **G3/G10:** all mechanisms are $0 and deterministic (lint + router + git); no embeddings required for the floor (AC-R6 keeps index-first). Non-goal: a learned compressor / KV-cache paging engine (deferred; the markdown store gets *behavioural* demand-paging via retrieval-on-demand, not a token-level pager).
- Risk: over-aggressive eviction hides a needed fact → mitigated by AC-R3 archive-not-delete + the `recallMiss` canary driving re-residency.

## PANEL SUMMARY
"Set an explicit always-resident memory token budget (ceiling = the documented Claude Code 200-line/25KB `MEMORY.md` behaviour) enforced by a `mem-budget-lint`; keep `MEMORY.md` a thin index and page notes in on demand via the existing read-router (top-k, dedupe distractors); place critical directives at head/tail to dodge the lost-in-the-middle death zone; extend the #3137 resident/on-demand classifier to memory records; and add a resident-token gauge to the G8 surface. All $0/deterministic, no embeddings. Sound and safe?"

## Decision log (G8)
- 2026-07-10 — Recommend token-budgeted, retrieval-on-demand, rot-aware residency built on existing #3137 + read-router. Reversible. Cross-family panel: receipt above / #3725 comment.
