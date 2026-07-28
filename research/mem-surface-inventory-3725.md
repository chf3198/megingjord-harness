---
title: Harness memory-surface inventory — Phase-0 ground truth (#3725)
ticket: 3725
epic: 3724
lane: docs-research
last_updated: 2026-07-10
status: ratified
related:
  - "[[guardrail-first-anneal-routing-3380]]"
  - "[[three-wiki-typology-synthesis-1943]]"
  - "[[operator-memory-promotion-audit-2026-05-30]]"
  - "[[multi-wiki-retrieval-mechanisms-1858]]"
---

# Harness memory-surface inventory — Phase-0 ground truth (#3725)

This is the **as-is** map every AC-R finding cites. Verified against the working
tree on branch `feat/3725-memory-rp` (from `origin/main`), 2026-07-10. Numbers are
`grep`-measured, not asserted, so the SOTA gap analysis rests on facts.

## 1. Storage & privacy tiers (three, orthogonal to content-type)

| # | Tier | Location | Committed? | Private? | Nature |
|---|---|---|---|---|---|
| T1 | Repo-committed wiki | `wiki/` — A `code/`, B `work-log/`, C `wisdom/` | yes (merged to `main`) | no (log-redacted, public) | knowledge by **content type** |
| T2 | User-global mirror | `~/.copilot/wiki/` | derived (read-only mirror of `wiki/wisdom/global/`) | no | cross-project distribution |
| T3 | Workspace-private operator memory | `~/.claude/projects/<ws>/memory/` + `MEMORY.md` | **gitignored / out-of-repo** | **yes** | per-workspace operator facts |

Confirmed present this session: `wiki/{code,work-log,wisdom}`, `wiki/wisdom/{global,project}`,
`~/.copilot/wiki/{concepts,entities,sources,syntheses,skills,...}`, and the operator
memory folder with 7 memory files + `MEMORY.md` index.

## 2. Content-type wikis (T1 detail) — from `wiki/WIKI-typology.md`

- **Wiki A `code/`** — annotated understanding of this repo's own source. Update trigger: significant code merge. Consumer: `wiki-search.js`. Durability class: **mirror** (regenerable from source).
- **Wiki B `work-log/`** — session audit trail + governed ticket history. **Append-only** (never edit past entries). Update trigger: every governed PR merge. Durability class: **mirror**. *This is the store frozen by #3723 (mirrors stuck at 2026-06-17).*
- **Wiki C `wisdom/`** — distilled external knowledge + cross-system insight; sub-paths `global/` (harness-wide, distributed to T2) and `project/` (**A4 namespace isolation — never distributed**). Durability class: **asset** (human/agent-authored, not regenerable).

## 3. Frontmatter contract (measured occurrence across `wiki/`)

| Field | Count | Role |
|---|---|---|
| `status:` | 2838 | lifecycle |
| `related:` | 2804 | wikilinks / cross-refs |
| `last_updated:` | 2663 | snapshot recency |
| `source_path:` | 2661 | provenance |
| `content_trust_score:` | 2660 | trust weighting |
| `source_sha256:` | 2657 | provenance integrity |
| `content_hash:` | 2137 | change detection |
| `scope:` | 49 | global/project isolation |
| `freshness_window:` | **4** | staleness bound (barely adopted) |
| `valid_from:` / `valid_to:` | **0** | **no bitemporal validity model exists** |

**Key facts for the SOTA gap:** recency is a single `last_updated` snapshot; there is
**no** `valid_from`/`valid_to`, so a contradicted fact is *overwritten*, not *closed*
(AC-R2). `freshness_window` exists in contract but is effectively unused (4 pages) —
staleness is not enforced by data (AC-R2/AC-R4). `scope:` carries the isolation signal
but appears on only 49 pages (AC-R5).

## 4. Cross-cutting machinery (measured against `scripts/global/`)

- **Anneal classifier (#3380)** — `classifyFriction() -> {guardrail-candidate | skill | semantic-memory | forget}`, fail-open to `semantic-memory`, `forget` decays per its Q4. This is a **partial** episodic/semantic/procedural router: `skill`≈procedural, `semantic-memory`≈semantic, `forget`≈decay — but **no episodic store and no episodic→semantic consolidation** (AC-R1/AC-R3).
- **Write routing** — `memory-write-router.js` (#3128) maps `factClass → {home, durability, private}` deterministically ($0, no LLM). Durability tiers already named: **asset / mirror / runtime**; `private` flag already exists per fact-class (`operator-pref → ~/.claude, private:true`). This is a real, reusable taxonomy spine (AC-R1/AC-R5).
- **Read routing** — `read-router.js` (#3130) `routeQuery(class) → {subWiki, strategy}`; **index-first + grep is the $0 portable floor**; heavy sweeps route to a sub-agent returning a 1–2K digest (keeps big reads out of the main window); **embeddings/graph are DEFERRED (replay-eval-gated)**; `recallMiss()` emits a schema-v3 **G8** signal so index-first degradation is *observed, not silent* (AC-R4/AC-R6).
- **Namespace isolation (A4)** — cross-wiki wikilinks require an explicit `code::`/`work-log::`/`wisdom::` prefix + a `related:` justification; `wisdom/project/` is never distributed to T2 (AC-R5 invariant).
- **Health / drift / reconcile** — mirror reconcile cron + wiki lint (≤100 lines except `wisdom/`), drift replay-eval. **No LongMemEval/LoCoMo-style retrieval+forgetting eval** for the memory system as a whole (AC-R6).

## 5. Operator memory (T3 detail)

`MEMORY.md` is an index (one line per memory file) **resident every session** (token
cost, AC-R4). Files carry frontmatter `type: user | feedback | project | reference`
— an *implicit* taxonomy that mixes CoALA classes (user facts = semantic; feedback =
procedural/judgment; project state = episodic). Files link via `[[name]]` (AC-R1).

## 6. The seven SOTA gaps (Epic #3724 → this gate's AC-Rk)

1. No temporal validity model (§3) → **AC-R2**
2. No shared CoALA taxonomy across stores (§4 classifier is partial) → **AC-R1**
3. Consolidation absent (episodic never distilled to semantic) → **AC-R3**
4. Context-budget / context-rot risk (`MEMORY.md` + resident instructions) → **AC-R4**
5. Forgetting only via guardrail-ships-→-delete + `forget` decay → **AC-R3**
6. No memory-specific eval harness → **AC-R6**
7. Privacy/scope tiers emerged implicitly (§1) → **AC-R5**; write-path durability blocker → **AC-R7** (#3723)

## Decision log (G8)
- 2026-07-10 — Inventory ratified as shared ground truth for #3725. No design choice made here; this is the measured baseline. Reversible; no panel required (facts, not judgment).
