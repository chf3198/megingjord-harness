---
applyTo: "**"
---

# Wiki Knowledge — Global Instruction

## LLM Wiki Availability

Compiled wiki at `~/.copilot/wiki/` — cross-referenced fleet, skills, governance, architecture, and research.

## Access Model

| Operation | Where | Command |
|---|---|---|
| **Search (compiled)** | Any repo | `node ~/.copilot/scripts/wiki-search.js "query"` |
| **Read** | Any repo | Read `~/.copilot/wiki/index.md` then drill into pages |
| **Search (source)** | Megingjord only | `npm run wiki:search -- "query"` |
| **Ingest** | Megingjord only | `npm run wiki:ingest -- raw/articles/<file>.md` |
| **Lint** | Megingjord only | `npm run wiki:lint` |
| **Anneal** | Megingjord only | `npm run wiki:anneal` |

End-to-end ingest pipeline (raw/articles → wiki/sources → entity/concept
pages → index.md → log.md) is documented in `WIKI.md`; the
contributor walkthrough is `docs/howto/contribute-to-wiki.md`.

## When to Use the Wiki

Check wiki before research tasks, when answering fleet/governance/architecture questions, when cross-referencing skills or ADRs, and after significant work (suggest updates).

## Wiki Structure

- `wiki/index.md` — read this first to find relevant pages
- `wiki/entities/` — devices, services, tools
- `wiki/concepts/` — patterns, protocols, decisions
- `wiki/sources/` — digests of raw research documents
- `wiki/syntheses/` — cross-cutting analysis

## Rules

- Wiki at `~/.copilot/wiki/` is **read-only** from non-Megingjord repos
- Never edit `~/.copilot/wiki/` directly — changes flow through Megingjord
- Cite wiki pages with `[[page-name]]` wikilink syntax
- If wiki content is stale, note it for Megingjord maintenance
