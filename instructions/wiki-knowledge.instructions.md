---
applyTo: "**"
---

# Wiki Knowledge — Global Instruction

## LLM Wiki Availability

A compiled Karpathy LLM Wiki is deployed at `~/.copilot/wiki/`.
This wiki contains cross-referenced knowledge about the fleet,
skills, governance, architecture, and research.

## Access Model

| Operation | Where | Command |
|---|---|---|
| **Search** | Any repo | `node ~/.copilot/scripts/wiki-search.js "query"` |
| **Read** | Any repo | Read `~/.copilot/wiki/index.md` then drill into pages |
| **Ingest** | devenv-ops only | `npm run wiki:ingest -- raw/articles/<file>.md` |
| **Lint** | devenv-ops only | `npm run wiki:lint` |
| **Anneal** | devenv-ops only | `npm run wiki:anneal` |

## When to Use the Wiki

- Before research tasks: check if the wiki already has compiled knowledge
- When answering questions about fleet topology, governance, or architecture
- When cross-referencing skills, instructions, or ADR decisions
- After completing significant work: suggest wiki updates in devenv-ops

## Wiki Structure

- `wiki/index.md` — read this first to find relevant pages
- `wiki/entities/` — devices, services, tools
- `wiki/concepts/` — patterns, protocols, decisions
- `wiki/sources/` — digests of raw research documents
- `wiki/syntheses/` — cross-cutting analysis

## Rules

- Wiki at `~/.copilot/wiki/` is **read-only** from non-devenv-ops repos
- Never edit `~/.copilot/wiki/` directly — changes flow through devenv-ops
- Cite wiki pages with `[[page-name]]` wikilink syntax
- If wiki content is stale, note it for devenv-ops maintenance
