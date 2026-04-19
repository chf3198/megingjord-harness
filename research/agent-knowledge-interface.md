# Agent Knowledge System Interface

**Date**: 2026-04-19
**Status**: Active
**Parent**: Epic #309 (O5: Agent-Enhancing Knowledge Systems)

## Interface Contract

Any agent enhancement tool must implement these capabilities:

### Required Methods

| Method | Purpose | Returns |
|--------|---------|---------|
| `ingest(source)` | Add knowledge from a source | `{ pages: number, errors: string[] }` |
| `search(query)` | Retrieve relevant knowledge | `{ results: { title, content, score }[] }` |
| `health()` | Report system health | `{ pages, categories, staleCount, issues }` |
| `metrics()` | Usage and performance stats | `{ accessCount, cacheHits, lastAccess }` |

### Optional Methods

| Method | Purpose |
|--------|---------|
| `anneal()` | Self-correct stale or inconsistent entries |
| `prune(criteria)` | Remove entries matching criteria |
| `export(format)` | Export knowledge in portable format |

## Current Implementations

### 1. LLM Wiki (Active)
- **Skill**: `llm-wiki-ops-portable`
- **Scripts**: `scripts/wiki/` (ingest, lint, anneal, search)
- **API**: `/api/wiki-health`, `/api/wiki-pages`, `/api/wiki-metrics`
- **Status**: Implements all required + optional methods

## Extension Points

To add a new knowledge system:
1. Create scripts in `scripts/<system-name>/` implementing required methods
2. Add API endpoints in `dashboard-server.js`
3. Register in dashboard via a `js/<system-name>-panel.js` module
4. Update `skills/<system-name>/SKILL.md` with usage instructions

No core harness modifications required — new systems are additive.

## Design Principles

- Knowledge systems are **plugins**, not core dependencies
- The dashboard discovers available systems via API endpoints
- Systems can be enabled/disabled per workspace via config
- Data formats should be portable (JSON/Markdown preferred)
- Systems must report their own health — no external polling needed
