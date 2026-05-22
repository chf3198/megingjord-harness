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

### Three-Wiki typology (Phase-1 stubs from #2051; full migration follow-on)

Per `research/three-wiki-typology-synthesis-1943.md` (Epic #1942 Phase-0):

- `wiki/code/` (Wiki A) — Code-Base Wiki (per-project; symbols + concepts)
- `wiki/work-log/` (Wiki B) — Project Work-Log Wiki (per-project; mirrors GitHub tickets + PRs)
- `wiki/wisdom/project/` (Wiki C scope=project) — Project-specific research wisdom (per-project, **NEVER distributed cross-project**)
- `wiki/wisdom/global/` (Wiki C scope=global) — Cross-project wisdom (distributed to operator-global `~/.copilot/wiki/`)

### Legacy paths (still in use; will migrate to wiki/wisdom/global/)

- `wiki/entities/` — devices, services, tools (→ `wiki/wisdom/global/entities/`)
- `wiki/concepts/` — patterns, protocols, decisions (→ `wiki/wisdom/global/concepts/`)
- `wiki/sources/` — digests of raw research documents (→ `wiki/wisdom/global/sources/`)
- `wiki/syntheses/` — cross-cutting analysis (→ `wiki/wisdom/global/syntheses/`)
- `wiki/skills/` (→ `wiki/wisdom/global/skills/`)

Physical migration of legacy paths is queued as a follow-on to #2051.

## Rules

- Wiki at `~/.copilot/wiki/` is **read-only** from non-Megingjord repos
- Never edit `~/.copilot/wiki/` directly — changes flow through Megingjord
- Cite wiki pages with `[[page-name]]` wikilink syntax
- If wiki content is stale, note it for Megingjord maintenance
