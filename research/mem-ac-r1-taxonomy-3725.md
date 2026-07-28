---
title: "AC-R1 — Memory taxonomy: map harness stores onto CoALA (episodic/semantic/procedural/working)"
ticket: 3725
epic: 3724
lane: docs-research
ac: AC-R1
last_updated: 2026-07-10
status: ratified
cross_family_receipt: 059a3bbfa428c5d3
related:
  - "[[mem-surface-inventory-3725]]"
  - "[[guardrail-first-anneal-routing-3380]]"
---

# AC-R1 — Memory taxonomy (CoALA mapping + target ownership)

## Question
Map every harness store onto the **episodic / semantic / procedural / working** taxonomy (CoALA) and decide the target taxonomy + which store owns which class.

## SOTA evidence
- **CoALA** (Sumers, Yao, Narasimhan, Griffiths — arXiv **2309.02427**) is the field reference: working (current context) / episodic (specific past events) / semantic (general facts) / procedural (skills — implicit in weights + explicit in agent code/prompts). *(The #3725 corpus cited "2602.19320" for the Anatomy paper; the canonical CoALA id is 2309.02427 — cited here as the load-bearing source.)*
- **Mem0** — vector store = semantic; graph store = temporal/relational (episodic links); KV = structured facts; scoping tiers `user_id` (semantic) > `session_id`/`run_id` (episodic) > raw history (working). (docs.mem0.ai/core-concepts/memory-types)
- **Letta/MemGPT** — core memory (in-context blocks) = working; recall memory (conv history) = episodic; archival (vector store) = semantic; procedural lives in system prompt / learned edit behaviors. (letta.com/blog/agent-memory)
- **LangMem/LangGraph** — short-term = thread-scoped checkpointer (working); long-term = `BaseStore` namespaces **explicitly labelled semantic / episodic / procedural**. This key-value-namespace store is the **closest analog** to a markdown+git wiki (no graph engine). (langchain.com/blog/langmem-sdk-launch)

## Harness mapping (as-is → CoALA)
| CoALA class | As-is store(s) | Gap |
|---|---|---|
| **working** | model context window; resident `MEMORY.md` index + instructions (#3137) | over-resident (AC-R4) |
| **episodic** | Wiki B `work-log/` (append-only sessions/tickets); operator `project`-type notes | **no consolidation to semantic** (AC-R3); B frozen (#3723) |
| **semantic** | Wiki C `wisdom/` (global+project); operator `user`/`reference` notes; anneal `semantic-memory` dest | scattered; scope implicit (AC-R5) |
| **procedural** | Wiki A `code/`; `docs/howto/` runbooks; `instructions/`; skills; anneal `skill` dest | not labelled as one class |

The **#3380 anneal classifier** already routes `guardrail | skill | semantic-memory | forget` — i.e. procedural(`skill`)/semantic/decay — but has **no episodic destination and no episodic→semantic consolidation edge**. The **`memory-write-router.js`** `factClass→home` table is the real taxonomy spine (durability asset/mirror/runtime + `private` flag already present).

## Decision (recommended target taxonomy)
Adopt CoALA as the **explicit cross-store vocabulary**, layered on the *existing* stores (do not rebuild — Epic #3719 evolve-not-rebuild lesson):

1. **`memory_class:` frontmatter** (`working|episodic|semantic|procedural`) on every memory record + wiki page — one authoritative label per record, derived from the write-router `factClass` (add a `factClass→memory_class` column, not a new store).
2. **Store ownership (target):** episodic → Wiki B `work-log/` + operator `project` notes; semantic → Wiki C `wisdom/` + operator `user`/`reference`; procedural → Wiki A `code/` + `docs/howto/` + `instructions/` + skills; working → context only (never persisted as a durable class).
3. **Consolidation edge (new, spec'd in AC-R3):** episodic→semantic/procedural is the missing CoALA operation; the anneal classifier gains an explicit episodic intake + a consolidation destination.
4. Operator-memory `type:` (`user|feedback|project|reference`) maps deterministically: user→semantic, feedback→procedural, project→episodic, reference→semantic. Keep `type:` (human-facing) + add derived `memory_class:` (machine-facing).

## Tradeoffs / non-goals
- **G10 Maintainability:** a label is cheap; a store migration is not — so we relabel, not re-home. **G3:** zero new infra. Risk: label drift → mitigated by deriving `memory_class` from the deterministic write-router, not hand-authoring.
- Non-goal: a graph/vector store to hold the taxonomy (deferred; AC-R6 keeps index-first floor).

## PANEL SUMMARY (recommendation under cross-family review)
"Adopt CoALA (episodic/semantic/procedural/working) as an explicit `memory_class:` frontmatter label derived deterministically from the existing `memory-write-router.js` factClass table — relabelling existing stores rather than building new ones — and add an episodic→semantic consolidation edge to the #3380 anneal classifier. Sound?"

## Decision log (G8)
- 2026-07-10 — Recommend relabel-not-rebuild CoALA mapping. Reversible (frontmatter + a table column). Cross-family panel: see `cross_family_receipt` above / #3725 comment.
