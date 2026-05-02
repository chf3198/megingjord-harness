# WIKI.md — LLM Wiki Schema

> The LLM reads this file to understand how the wiki works.
> Co-evolved by human and LLM as conventions mature.

## Architecture (3 layers)

| Layer | Path | Owner | Mutability |
|---|---|---|---|
| Raw sources | `raw/` | Human curates | Immutable after placement |
| Wiki | `wiki/` | LLM writes | LLM updates freely |
| Schema | `WIKI.md` | Co-owned | Changed by agreement |

## Page Types

| Type | Directory | Purpose |
|---|---|---|
| Entity | `wiki/entities/` | Person, device, service, tool |
| Concept | `wiki/concepts/` | Idea, pattern, technique, decision |
| Source summary | `wiki/sources/` | Digest of one raw source |
| Synthesis | `wiki/syntheses/` | Cross-cutting analysis, comparisons |

## Frontmatter (required on every wiki page)

```yaml
---
title: "Page Title"
type: entity | concept | source | synthesis
created: 2026-04-13
updated: 2026-04-13
tags: [tag1, tag2]
sources: [raw/articles/filename.md]
related: ["[[Other Page]]"]
status: stub | draft | mature
---
```

## Naming Conventions

- Filenames: `kebab-case.md` (e.g., `penguin-1.md`, `llm-wiki-pattern.md`)
- Wikilinks: `[[page-name]]` — no path prefix, no extension
- One concept per page — split if a page exceeds 80 lines of content

## Special Files

- `wiki/index.md` — catalog of every page, grouped by type. Updated on
  every ingest. LLM reads this first when answering queries.
- `wiki/log.md` — append-only chronological record of operations.
  Format: `## [YYYY-MM-DD] operation | Subject`

## Operations

| Operation | Command | Script |
|---|---|---|
| Ingest | `npm run wiki:ingest -- raw/articles/<file>.md` | `scripts/wiki/ingest.js` |
| Lint | `npm run wiki:lint` | `scripts/wiki/lint.js` |
| Anneal | `npm run wiki:anneal` | `scripts/wiki/anneal.js` |
| Search | `npm run wiki:search -- "query"` | `scripts/wiki/search.js` |

`wiki:search` is exposed globally as `node ~/.copilot/scripts/wiki-search.js` after deploy.

### Ingest pipeline (raw/articles → wiki/sources → entities/concepts)

`wiki:ingest` implements steps 3–6; 1–2 and 7 are judgment calls.

1. Human places source in `raw/articles/<slug>.md` with `status: pending`
2. LLM reads source, discusses key takeaways
3. LLM writes `wiki/sources/<slug>.md` summary
4. LLM updates entity/concept pages
5. LLM updates `wiki/index.md`
6. LLM appends entry to `wiki/log.md`
7. Mark raw source `status: ingested` and commit

Walkthrough: `docs/howto/contribute-to-wiki.md`.

### Query and lint

Query: LLM reads `wiki/index.md`, then drills into pages, synthesizes
with `[[citations]]`; valuable answers get filed as syntheses. Lint
checks broken wikilinks, orphans, frontmatter completeness, index
drift, contradictions, and stale claims.

## Cross-Reference Rules

- Every entity/concept page must link to ≥1 related page
- Source summaries must link to entities/concepts they mention
- Syntheses must cite ≥2 source/concept pages
- Bidirectional: if A links to B, B should link back to A

## Fleet Routing (inference operations)

| Operation | Primary | Failover |
|---|---|---|
| Ingest | OpenClaw (deepseek-coder-v2:lite) | Groq, Cerebras |
| Query | OpenClaw | Copilot Pro |
| Lint | Local scripts | Groq |

## Constraints

- Wiki files ≤100 lines; markdown only; git-tracked; raw sources are the source of truth, wiki is derived.
