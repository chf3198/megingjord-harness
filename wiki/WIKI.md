# WIKI.md — LLM Wiki Schema

> The LLM reads this file to understand how the wiki works.
> Co-evolved by human and LLM as conventions mature.
> Operations detail: [`wiki/WIKI-operations.md`](WIKI-operations.md)
> Typology and fleet routing: [`wiki/WIKI-typology.md`](WIKI-typology.md)

## Three-wiki typology

| Sub-wiki | Path | Purpose |
|---|---|---|
| **Code wiki** | `wiki/code/` | Annotated code understanding |
| **Work-log wiki** | `wiki/work-log/` | Session and ticket audit trail (append-only) |
| **Wisdom wiki** | `wiki/wisdom/` | Distilled knowledge, research, and fleet entity pages |

## Three-layer architecture

| Layer | Path | Owner | Mutability |
|---|---|---|---|
| Raw sources | `raw/` | Human curates | Immutable after placement |
| Wiki pages | `wiki/` | LLM writes | LLM updates freely |
| Schema | `WIKI.md` | Co-owned | Changed by agreement |

## Page types

| Type | Directory | Purpose |
|---|---|---|
| Entity | `wiki/*/entities/` | Person, device, service, tool |
| Concept | `wiki/*/concepts/` | Idea, pattern, technique, decision |
| Source summary | `wiki/*/sources/` | Digest of one raw source |
| Synthesis | `wiki/*/syntheses/` | Cross-cutting analysis, comparisons |

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
status: stub | draft | active | deprecated
confidence: high | medium | low
last_verified: 2026-04-30
sources_count: N
superseded_by: "[[newer-page]]"   # optional
---
```

**Confidence**: `high` = 3+ sources; `medium` = 1–2; `low` = 1 or inferred.
**Staleness**: `last_verified` >90 days → stale warning during lint.

## Naming conventions

- Filenames: `kebab-case.md` (e.g. `penguin-1.md`, `llm-wiki-pattern.md`)
- Wikilinks: `[[page-name]]` — no path prefix, no extension
- One concept per page — if content exceeds 80 lines, split into linked pages

## Special files

- `wiki/index.md` — catalog of every page, grouped by type; updated on ingest
- `wiki/log.md` — append-only chronological ops record
- `wiki/WIKI-operations.md` — ingest, query, lint, and anneal procedures
- `wiki/WIKI-typology.md` — three-wiki typology, fleet routing, namespace rules
