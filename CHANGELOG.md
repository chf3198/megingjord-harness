# Changelog

## [3.0.1] - 2026-04-14

### Added — Wiki Self-Annealing (#96)
- `scripts/wiki/anneal.js`: auto-fix broken links, orphans, frontmatter
- `npm run wiki:anneal` (dry-run default, `--apply` to write)
- Fuzzy slug matching, index backlink insertion, frontmatter template

### Added — SSE Push Model (#97)
- `/api/events/stream` SSE endpoint in dashboard-server.js
- `scripts/sse-handler.js`: fs.watch() on events.jsonl, broadcasts
- `dashboard/js/event-source.js`: EventSource client + polling fallback
- Dashboard init() connects SSE, degrades to polling on error

## [2.4.1] - 2025-07-14

### Fixed — Dashboard UX Polish (11 issues from v2.4.0 UAT)
- **Header status**: Exclude unknown devices from `overallStatus`
- **Tailscale count**: Filter un-inventoried devices (2/2 not 2/3)
- **Fleet topology**: ⭐ marker on local Copilot Chromebook
- **Help toggle**: Fix Alpine v3 API (`_x_dataStack` not `__x.$data`)
- **Refresh slider**: Live value display while dragging
- **Activity log**: Height doubled (150→320px) for more entries
- **Quotas**: Compact row layout, no scroll needed
- **Router Lanes**: Empty state with ring + lane chip visualization
- **Router Log**: Entries now fed from event bus agent+model data
- **Wiki panel**: Relative timestamps, stat boxes, compact tags
- **Stress test**: Parallel 3-ticket simulation through roles

## [2.4.0] - 2026-04-14

### Added — Epic 1: Live Event System (#35)
- **Event emitter** (`scripts/global/emit-event.js`): CLI + module that
  appends structured JSONL to `.dashboard/events.jsonl`
- **Event reader** (`scripts/global/event-reader.js`): Server-side reader
  with `?since=<ts>` filtering for the dashboard API
- **Event bus client** (`dashboard/js/event-bus.js`): Polls `/api/events`,
  converts to activity entries and baton state
- **`/api/events` endpoint**: Dashboard server serves events from JSONL
- **Agent names in baton**: Panel shows 🎭 agent name from event data
- **`.dashboard/` gitignored**: Runtime event log excluded from commits

## [2.3.0] - 2026-04-13

### Changed
- **Stress test→Agile Epic**: 12-phase baton workflow replaces ping-based test.
  Exercises 33 skills across Manager→Collaborator→Admin→Consultant roles.
  Baton panel and activity feed light up with per-phase events.
- **Auto-refresh default 60→5s**: Configurable 3–60s via range slider in
  Dashboard Settings panel. Feels alive with real-time data.
- **Help Center dev/user toggle**: Developer view adds code paths, file
  references, function names (10× detail). Toggle button in Help toolbar.
- **Service dashboard links**: Each service card links to its web console
  (GitHub, Cloudflare, OpenRouter, Groq, Cerebras, AI Studio, OpenClaw).

## [2.2.0] - 2026-04-14

### Changed
- **2-column grid**: Fleet view uses 2×2 panel layout instead of stacked
  full-width sections — everything visible without scrolling at 960×1080
- **Compact topology**: SVG shrunk from 680×200 to 400×120; unroutable
  devices (no Tailscale IP) filtered from graph, noted in legend
- **Resource cards**: 3-column card grid replaced with compact single-line
  stack that fits half-width column
- **Tooltips proximity**: Gap reduced 6→2px, hide timers increased to
  500ms/400ms — tooltips stay visible while user moves mouse to them
- **Tooltip width**: Reduced 260→220px for tighter fit
- **Test stays on Fleet**: Stress test no longer switches to Ops view;
  per-round activity events feed live to Fleet activity panel
- **Help Center**: Collapsible `<details>` sections with search input;
  10 detailed documentation sections covering all dashboard features
- **Responsive breakpoint**: Media query lowered from 1024→640px so
  2-column grid works at 960px target viewport

### Added
- `help-content.js`: 10 structured help sections with data source docs
- Per-round activity logging during stress test

## [Unreleased]

### Added
- **LLM Wiki Phase 4 — Bootstrap + Skill** (#30, #31):
  Ingested 3 raw sources via OpenClaw (fleet, skills, Karpathy pattern).
  Created `llm-wiki-ops` maintenance skill (34th skill).
- **LLM Wiki Phases 1–3** (#25–#29): Full wiki pipeline — ingest, lint,
  search, Foam, dashboard panel. Karpathy LLM Wiki pattern.

### Added
- **Model routing agents**: 8 custom agents with pinned models (ADR-004)

## [1.5.0] - x-if architecture, XSS hardening, pure Alpine tooltips, CDP tests
## [1.4.0] - Half-screen UX, multi-view tabs, stress test, CDP quality suite
## [1.3.0] - Visual QA, self-annealing epic
## [1.2.0] - Dashboard revamp, router metrics, accessibility
## [1.1.1] – Repo-scoped Agile workflow opt-in
## [1.1.0] – Ticket-driven work: issue per task, branch/commit gates
## [1.0.0] – Tiered agent architecture, Cynefin scoring, global task router
## [0.1.0] – Genesis: repo structure, governance, dashboard, skills
