---
title: LLM Wiki Critical Analysis & 2026 Best Practices
type: synthesis
created: 2026-04-30
updated: 2026-04-30
tags: [wiki, knowledge-management, karpathy, architecture, research]
related: ["[[wiki-pattern]]", "[[karpathy-llm-wiki-pattern]]", "[[llm-wiki-implementation-plan]]"]
status: active
confidence: high
sources_count: 16
last_verified: 2026-04-30
---

# LLM Wiki Critical Analysis & 2026 Best Practices

## Summary

Web-sourced research synthesis (2026-04-30) assessing the current state of the Karpathy
LLM Wiki pattern against the 2026 landscape. Verdict: the flat-markdown architecture is
validated and well-aligned with production findings. Five additive improvements identified —
no architectural replacement warranted at 62-page scale.

## Canonical Pattern — April 2026 State

Karpathy's LLM wiki gist (Apr 2026, 16M views) remains the canonical reference.
Core: immutable `raw/` sources → LLM-maintained `wiki/` markdown → `WIKI.md` schema.
`index.md` as content-oriented catalog; `log.md` as append-only operation record.
Intentionally minimal: no typed relationships, no automation hooks, no confidence scores.

## Community v2 Additions (April 2026)

The `rohitg00` v2 gist captured production lessons and added:

| Addition | Value | Adoption Cost |
|---|---|---|
| Confidence scoring per fact (`high/medium/low`) | Prevents silent rot | Low — frontmatter field |
| Supersession tracking (`superseded_by`) | Explicit lineage | Low — frontmatter field |
| Typed wikilinks via `@` suffix | Relationship semantics | Medium — naming convention |
| `relationships.json` edge list | Graph traversal | High — tooling |
| Event-driven automation hooks | Prevents wiki rot | Medium — scripts |

**Verdict for this wiki**: adopt confidence scoring and supersession tracking (frontmatter
only). Defer `relationships.json` edge list until >150 pages.

## Architecture Decision: Keep Flat-Markdown

At 62 pages, flat-file wiki outperforms every alternative on every dimension:

| Alternative | Why Not |
|---|---|
| GraphRAG (Microsoft) | Designed for 10K+ document corpus; overkill at 100 pages |
| Mem0 / Zep | Cloud-dependent, API cost, Letta benchmarks show file ops win |
| Vector embeddings (Chroma, Pinecone) | Maintenance burden not justified until ~500 pages |
| Letta / MemGPT | For autonomous multi-day agents; wrong use case for governance wiki |

Letta benchmark (2026): plain **filesystem** approach scored 74.0% on LoCoMo vs
Mem0 graph at 68.5%. "Tool accessibility matters more than retrieval sophistication."

Anthropic context engineering guide confirms: just-in-time loading (index → targeted pages)
is the recommended pattern. Current `wiki_router.py` architecture is correct.

## Deficiencies Found in This Wiki (2026-04-30 Audit)

### Structural (lint violations — now fixed)
- 34 issues: 13 orphan pages, 18 missing frontmatter, 2 missing from index, 1 broken link
- 3 ghost source entries (linting-governance-rationale/tooling/rollout) — removed
- `type: concepts`/`sources`/`syntheses` plural errors on 7 pages — corrected
- `github-integration` used `category:` instead of `type:` field — corrected

### Session Routing Gap
`wiki_router.py` has no `infra-automation` routing branch. devenv-ops sessions (the primary
use case) receive only 2 wiki snippets (recent additions + wiki-pattern reminder) vs up to 4
for web-app repos. Governance concepts, fleet topology, model routing — never injected for
devenv-ops work.

### Content Staleness
Model routing page listed "Claude Opus 4.6" (should be Opus 4.7).
Log not updated since 2026-04-29 despite 6+ major merges (#360, #647, #595, Epic #335, etc.).

## 5 Improvement Recommendations (Priority-Ordered)

### 1. Add confidence + freshness frontmatter (P0)
Update `WIKI.md` schema:
```yaml
confidence: high | medium | low
last_verified: YYYY-MM-DD
sources_count: N
superseded_by: "page-name"  # optional wikilink, e.g. newer-page
```
Add lint rule: flag pages where `last_verified` is >90 days old.

### 2. Fix `wiki_router.py` infra-automation routing (P0)
Add governance routing for devenv-ops sessions: inject model-routing, fleet-architecture,
and governance-enforcement snippets when `infra-automation` repo type detected.

### 3. qmd as local hybrid-search MCP (P1)
`qmd` (https://github.com/tobi/qmd) combines SQLite FTS5/BM25 + local GGUF embeddings
+ Qwen3 reranker. No API keys, fully local, MCP-compatible.
Install: `npm install -g @tobilu/qmd`
Addresses the ~20% of queries where the index is ambiguous.

### 4. Typed relationship annotations (P1)
Adopt `@` suffix in wikilink aliases for four key types:
`@supersedes`, `@contradicts`, `@implements`, `@supports`
No tooling needed — naming convention only.

### 5. Frontmatter-only session map injection (P2)
Pre-session hook injecting: `index.md` + frontmatter-only of all pages (~8-15K tokens).
Gives LLM rich navigation without loading full page content at session start.

## What NOT to Do

- No vector embedding pipeline — not justified until ~500 pages
- No `relationships.json` edge list — tooling overhead, defer until >150 pages
- No `consolidation tiers` (v2 working/episodic/semantic) — over-engineered for human-paced governance wiki
- No Obsidian lock-in — it is optional visualization, not a dependency

## See Also

- [[wiki-pattern]] — core Karpathy concept
- [[llm-wiki-implementation-plan]] — prior implementation plan (Apr 2026)
- [[karpathy-llm-wiki-pattern]] — source digest
- [[governance-enforcement]] — wired into session injection
