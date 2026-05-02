# How to contribute to the Megingjord wiki

The wiki is the LLM's long-term memory: cross-referenced fleet,
governance, architecture, and research notes. It compiles into
`~/.copilot/wiki/` and is read by every runtime (Copilot, Claude Code,
Codex). This guide walks through adding a new source.

See `WIKI.md` for the schema reference and ADR-007 for the adoption
decision.

## Three layers (recap)

| Layer | Path | Edit by |
|---|---|---|
| Raw sources | `raw/articles/` | Human (curator) |
| Wiki | `wiki/` | LLM (auto via `wiki:ingest`) |
| Schema | `WIKI.md` | Co-owned, by agreement |

You always start in `raw/articles/`. The wiki itself is a derived
artifact — never hand-author `wiki/sources/`.

## Step-by-step ingest

### 1. Drop the raw source

Place the markdown in `raw/articles/<slug>.md` with frontmatter:

```yaml
---
title: "Source title"
type: research | audit | benchmark | article
created: 2026-05-02
status: pending
---
```

Filename slug is `kebab-case` and is the join key — both
`wiki/sources/<slug>.md` and the index entry derive from it.

### 2. Run the ingest script

From the Megingjord repo root:

```bash
npm run wiki:ingest -- raw/articles/<slug>.md
```

The `scripts/wiki/ingest.js` script:

1. Calls the configured fleet LLM (OpenClaw primary, Groq/Cerebras failover) to produce a structured summary
2. Writes `wiki/sources/<slug>.md`
3. Updates `wiki/index.md`
4. Appends an entry to `wiki/log.md`
5. Flips the raw source frontmatter to `status: ingested`

If the LLM is unreachable, the ingest aborts cleanly and leaves the raw
source untouched.

### 3. Cross-link entities and concepts

The script writes the **source page** but does not auto-create entity
or concept pages — that's the LLM's judgment call after reading the
source. After ingest:

1. Identify entities/concepts mentioned (devices, services, patterns, decisions)
2. Create or update the relevant `wiki/entities/<name>.md` or `wiki/concepts/<name>.md`
3. Add `[[source-slug]]` to the entity/concept's `sources:` frontmatter
4. Add reciprocal `[[entity-name]]` links from the source page's `related:` field

### 4. Lint and commit

```bash
npm run wiki:lint
```

Lint catches:

- Broken `[[wikilinks]]`
- Orphan pages (no inbound links)
- Missing required frontmatter fields
- Index drift
- Cross-page contradictions and stale claims

Fix any flagged issues, then commit:

```bash
git add raw/articles/<slug>.md wiki/sources/<slug>.md wiki/entities/<...>.md wiki/concepts/<...>.md wiki/index.md wiki/log.md
git commit -m "wiki: ingest <slug>"
```

### 5. Anneal (optional)

When several related pages have grown organically, run:

```bash
npm run wiki:anneal
```

`scripts/wiki/anneal.js` rewrites pages for cross-page consistency
without changing meaning. Diff before committing.

## Naming and structure rules

- Filenames: `kebab-case.md`, never `Capitalized.md` or `snake_case.md`
- One concept per page; split when content exceeds 80 lines
- Wikilinks: `[[page-name]]`, no path prefix, no extension
- Every entity/concept page must link to ≥1 related page
- Source summaries must link to the entities/concepts they reference
- Syntheses must cite ≥2 source/concept pages

## When to use the wiki

- Before research: search for prior work first
- When answering fleet/governance/architecture questions
- After significant work: suggest wiki updates as part of the closeout

Search from any repo:

```bash
node ~/.copilot/scripts/wiki-search.js "your query"
```

Search from inside Megingjord (with full source context):

```bash
npm run wiki:search -- "your query"
```

## Read-only from non-Megingjord repos

The compiled wiki at `~/.copilot/wiki/` is **read-only** from other
repos. All edits flow through Megingjord and propagate via
`scripts/sync.sh` / `scripts/deploy.sh`.

If you spot stale wiki content from another repo, open a Megingjord
issue rather than editing the compiled copy.

## Related

- `WIKI.md` — schema reference
- `instructions/wiki-knowledge.instructions.md` — global instruction
- `research/adr/007-llm-wiki-adoption.md` — adoption decision
- `research/adr/013-capability-detection-substrate.md` — capability gating used by ingest's LLM call
