---
title: "AC-R3 — Consolidation (episodic→semantic) + deterministic forgetting"
ticket: 3725
epic: 3724
lane: docs-research
ac: AC-R3
last_updated: 2026-07-10
status: ratified
cross_family_receipt: ab116b1f4dbcba8c
related:
  - "[[mem-surface-inventory-3725]]"
  - "[[mem-ac-r1-taxonomy-3725]]"
  - "[[guardrail-first-anneal-routing-3380]]"
---

# AC-R3 — Consolidation & forgetting

## Question
Design episodic→semantic consolidation + deterministic forgetting (temporal decay / relevance-scored eviction), evolving the #3380 guardrail-first classifier (`guardrail | skill | semantic-memory | forget`) toward the full model.

## As-is
The #3380 classifier routes friction to `guardrail-candidate | skill | semantic-memory | forget` (fail-open to `semantic-memory`; `forget` decays per its Q4). It has **no episodic intake and no consolidation edge** — episodic experience (work-log sessions, operator `project` notes) is never distilled into reusable semantic/procedural form; it only accretes. Forgetting is partial: guardrail-ships-→-delete-note + the `forget` decay path.

## SOTA evidence
- **Reflection (Generative Agents, arXiv 2304.03442):** append-only memory stream; retrieval = weighted **recency (exp-decay) + importance (LLM 1–10) + relevance**; **reflection** synthesizes higher-level inferences when summed importance crosses a threshold (~2–3/agent-day). Canonical "distil raw episodes into reusable abstractions" loop.
- **Letta sleep-time compute** (letta.com/blog/sleep-time-compute): a *separate* async agent (not the primary) reorganizes/consolidates archival items and rewrites memory blocks during idle turns — better latency + memory quality than single-agent MemGPT self-editing.
- **Memp (arXiv 2508.06433):** procedural memory as a first-class target; distils trajectories into step-level + script-level abstractions with an explicit **Build / Retrieve / Update** lifecycle that **deprecates stale procedures**; refined memory raises success + lowers steps on TravelPlanner/ALFWorld; procedures built by a strong model transfer to weaker ones. *(Directional VERIFIED; exact deltas UNVERIFIED.)*
- **Voyager (arXiv 2305.16291):** verified routines stored as a **skill library** indexed by NL-embeddings, top-5 retrieved per task; ablating the library collapses progress ~15.3× — the *distilled reusable library*, not raw traces, is the performance.
- **Forgetting/eviction consensus** (Mem0 eviction blog; "Memory in the Age of AI Agents" arXiv 2512.13564): **TTL on long-tail + LRU decay on a recency/frequency composite + supersession-on-write** (contradiction never co-resides). Safety rule: **prune redundant, archive don't hard-delete**.

## Decision (recommended)
Evolve #3380 into a **5-destination classifier + a consolidation loop**, staying deterministic/$0 and fail-open:

1. **Add an `episodic` destination.** Recurring/dated experience with no mechanical surface and no durable judgment routes to episodic (work-log / operator `project`), tagged with `memory_class: episodic` (AC-R1) + `valid_from` (AC-R2).
2. **Consolidation edge `episodic → semantic|procedural` (the missing CoALA op).** A **batch, idle/end-of-session pass** (Letta sleep-time pattern) — never inline — triggered by an **importance-accumulation threshold** (N new episodic notes or a summed-importance budget), not per write. It distils: repeated episodes → a semantic wisdom page; repeated correct multi-step procedures → a `skill`/`docs/howto` page (Memp/Voyager "store the verified procedure, not the transcript"). Consolidation **supersedes** source episodes (`valid_to` close, AC-R2), it does not duplicate them.
3. **Deterministic forgetting policy.** Per-record frontmatter `created`, `last_accessed`, `access_count`. Eviction = **TTL on long-tail episodic + LRU decay on a recency/frequency/importance composite + supersession-on-write**. **Archive (git-move / `status: archived`), never hard-delete** — git already gives safe, reversible forgetting; the `content_trust_score` decays as `last_updated` ages.
4. **Fail-open preserved:** unknown/low-confidence → `semantic-memory` (never silently forget a preference or convert it to a blocking guardrail — the #3380 invariant).

## Tradeoffs
- Consolidation is the one place an LLM is used ($0 fleet/local per WIKI-typology fleet routing; never paid). Batch/idle keeps it off the critical path and out of the resident context (AC-R4).
- **G4/G1:** archive-not-delete is auditable and reversible; consolidation must preserve `scope`/redaction of sources (AC-R5) — a consolidated page inherits the **most restrictive** scope of its sources (fail-closed).

## PANEL SUMMARY
"Evolve the #3380 classifier to 5 destinations by adding an `episodic` intake and an `episodic→semantic|procedural` consolidation edge run as a batch idle/end-of-session pass (Letta sleep-time; importance-threshold-triggered, never inline), distilling repeated episodes into wisdom/skill pages that SUPERSEDE (not duplicate) their sources; and adopt deterministic forgetting = TTL-on-long-tail + LRU/recency/frequency decay + supersession-on-write, archiving (never hard-deleting) via git, with fail-open-to-semantic-memory preserved and consolidated pages inheriting the most-restrictive source scope. Sound and safe?"

## Decision log (G8)
- 2026-07-10 — Recommend 5-dest classifier + batch consolidation + archive-not-delete forgetting. Reversible; $0 (local/fleet LLM only). Cross-family panel: receipt above / #3725 comment.
