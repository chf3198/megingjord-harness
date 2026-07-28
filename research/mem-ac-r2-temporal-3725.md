---
title: "AC-R2 — Temporal validity model (bitemporal valid_from/valid_to vs overwrite)"
ticket: 3725
epic: 3724
lane: docs-research
ac: AC-R2
last_updated: 2026-07-10
status: ratified
cross_family_receipt: 4b5f80bf107dd55c
related:
  - "[[mem-surface-inventory-3725]]"
  - "[[mem-ac-r1-taxonomy-3725]]"
---

# AC-R2 — Temporal validity model

## Question
Evaluate a bitemporal `valid_from`/`valid_to` model for work-log + wisdom facts (contradiction **closes** an edge rather than overwriting) vs the current `freshness_window`/overwrite model. Quantify the accuracy/hallucination trade-off vs effort.

## As-is (measured)
`last_updated:` on 2663 pages; `content_trust_score:` 2660; `freshness_window:` on only **4**; `valid_from`/`valid_to`: **0**. So recency is a single snapshot and a contradicted fact is **overwritten** — history survives only in `git`, and the *current view* cannot express "this fact held from X to Y" or "this was true then, corrected now."

## SOTA evidence
- **Zep/Graphiti** (arXiv **2501.13956**) tracks **four timestamps** on two timelines: transaction time (`t_created`/`t_expired` — when the system learned/superseded) and **valid time** (`t_valid`/`t_invalid` — when the fact held in the world). On contradiction it **invalidates the affected edge** (sets `t_invalid` = the invalidating fact's `t_valid`) — the old fact is **retained but closed**, so only current facts surface while history stays auditable.
- **Benchmarks (Zep paper):** LongMemEval — Zep **63.8%** vs full-context **55.4%** (gpt-4o-mini, +8.4pp / +15.2% rel); gpt-4o **71.2%** vs **60.2%** (+11pp). Per-category (gpt-4o): **temporal-reasoning +38.4%**, knowledge-update 83.3%, multi-session +30.7%. Context tokens **1.6k vs 115k (−98.6%)**; p95 latency **2.5–3.2s vs 29–31s (~−90%)**. *(The "vs Mem0 49%" figure is secondary reporting, not the paper's own baseline — treated as UNVERIFIED.)*
- **"From Recall to Forgetting"** (arXiv **2604.20006**, Memora / FAMA metric): retrieval competence ≠ temporal competence — presence-only metrics **overestimate** memory quality when superseded facts aren't excluded. This is the exact failure the overwrite model hides (git keeps the old fact reachable to a keyword router).

## Decision (recommended)
Adopt **valid time only** as frontmatter; get **transaction time free from git** (do not duplicate `t_created`/`t_expired` — `git log`/`blame`/deletion already are transaction time).

1. Add nullable **`valid_from:` / `valid_to:`** to the frontmatter contract for **fact-bearing** pages/records (Wiki B work-log entries, Wiki C wisdom facts, operator `user`/`project` notes). Absent = "currently valid, open interval."
2. **Close-don't-overwrite convention:** superseding a fact sets the old record's `valid_to` = successor's `valid_from` and marks `status: superseded` (+ `superseded_by:`), then appends the new record. The keyword/index router (AC-R6) filters `valid_to`-closed records out of the *current* view but keeps them for as-of queries.
3. **Retire the near-dead `freshness_window`** in favour of `valid_to` + `last_updated` (staleness = `last_updated` age; validity = the interval). Keep `content_trust_score`.
4. Scope: apply to **facts**, not procedural/asset pages (a runbook isn't "valid until"). `memory_class: episodic|semantic` gates eligibility (ties to AC-R1).

## Cost/benefit (honest)
- The graph DB's decisive wins (automatic LLM contradiction detection across related edges, sub-second temporal-hop retrieval at 100k facts, 98.6% token compression) are **NOT reproducible** in a markdown store without the vector/graph infra this design excludes. Contradiction detection stays **agent-in-loop at edit time**.
- What IS cheap and high-value: the **data model** (valid intervals + close-on-contradiction) and the **current-view filter**. Effort ≈ 2 frontmatter fields + a lint rule + a router filter. Break-even for migrating to Graphiti-style infra is when fact count × contradiction rate makes manual closure unmaintainable — **not at Phase-0 scale**.
- **G4/G1:** additive, non-lossy (closing ≠ deleting); strengthens auditability. No isolation/redaction impact.

## PANEL SUMMARY (recommendation under cross-family review)
"Add nullable `valid_from`/`valid_to` frontmatter to fact-bearing pages and adopt a close-don't-overwrite convention (supersession sets old `valid_to`=new `valid_from`, `status: superseded`), getting transaction-time free from git and retiring the near-unused `freshness_window`. Manual/agent-in-loop contradiction detection (no graph DB). Sound and safe?"

## Decision log (G8)
- 2026-07-10 — Recommend valid-time-only bitemporal (git = transaction time). Reversible (additive frontmatter). Cross-family panel: `cross_family_receipt` above / #3725 comment.
