# Changelog

## [3.0.2] - 2026-04-23

### Fixed — Agent Baton Filtering (#122)
- Baton panel displays only `in-progress` or `review` tickets
- GitHub issues without `status:*` label default to `backlog`
- Prevents 300+ untagged issues from flooding baton view

### Fixed — Context Flow Animation (#123)
- Context Flow SVG renders with all topology nodes and arrows
- Data packet animations display when active baton exists
- Fixed `isActive` parameter passing to arrow renderer

### Added — JSDoc Documentation
- `dashboardApp()`, `cfArrows()`, `syncWithGitHub()` documented
- Baton filter and Context Flow animation logic documented

## [3.0.1] - 2026-04-14

### Added — Wiki Self-Annealing (#96)
- `scripts/wiki/anneal.js`: auto-fix broken links, orphans, frontmatter
- `npm run wiki:anneal` (dry-run default, `--apply` to write)

### Added — SSE Push Model (#97)
- `/api/events/stream` SSE endpoint
- Event bus client with polling fallback

## [2.4.1] - 2025-07-14

### Fixed — Dashboard UX Polish (11 issues from v2.4.0 UAT)
- Header status, Tailscale count, Fleet topology, Help toggle
- Refresh slider, Activity log, Quotas, Router Lanes, Router Log
- Wiki panel, Stress test refinements

## [2.4.0] - 2026-04-14

### Added — Live Event System (#35)
- Event emitter and reader with JSONL persistence
- Event bus client with `/api/events` polling
- Agent names and activity tracking in baton panel

**See [CHANGELOG-archive.md](CHANGELOG-archive.md) for versions 2.3.0 and earlier.**
