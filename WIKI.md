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

### Ingest
1. Human places source in `raw/` with frontmatter
2. LLM reads source, discusses key takeaways
3. LLM writes `wiki/sources/<slug>.md` summary
4. LLM updates entity/concept pages (create or revise)
5. LLM updates `wiki/index.md` with new/changed pages
6. LLM appends entry to `wiki/log.md`
7. Mark raw source frontmatter `status: ingested`

### Query
1. LLM reads `wiki/index.md` to find relevant pages
2. LLM reads those pages, synthesizes answer with `[[citations]]`
3. Valuable answers get filed as `wiki/syntheses/<slug>.md`

### Lint
1. Check for broken `[[wikilinks]]` (target page must exist)
2. Check for orphan pages (no inbound links)
3. Check frontmatter completeness (all required fields present)
4. Check `wiki/index.md` is in sync with actual wiki/ contents
5. Flag contradictions between pages
6. Flag stale claims superseded by newer sources
7. Output: health report with actionable items

## Cross-Reference Rules

- Every entity/concept page must link to ≥1 related page
- Source summaries must link to entities/concepts they mention
- Syntheses must cite ≥2 source/concept pages
- Bidirectional: if A links to B, B should link back to A

## Fleet Routing (for inference operations)

| Operation | Primary | Failover |
|---|---|---|
| Ingest (summarize + cross-ref) | OpenClaw (7B) | Groq, Cerebras |
| Query (synthesis) | OpenClaw (7B) | Copilot Pro |
| Lint (structural checks) | Local scripts | Groq (fast) |

## Constraints

- All wiki files ≤100 lines (split if needed)
- Markdown only — no HTML, no binary files in wiki/
- Git tracks everything — wiki/ is version-controlled
- Raw sources are the source of truth; wiki is derived
