# Changelog

## [Unreleased]

### Added
- (none yet)

## [1.2.0] - 2026-04-13

### Added
- Dashboard revamp epic with phased delivery plan for UAT
- Router metrics API endpoint (`/api/router/metrics`) served by dashboard backend
- Dashboard settings panel (auto-refresh state + high-contrast preference)
- Accessibility upgrades: skip-link, focus-visible controls, dark-safe router panel
- Playwright dashboard E2E tests with screenshot artifact (`test-results/dashboard-home.png`)
- Research brief on world-class dashboard practices and implementation checklist

### Changed
- Router metrics fetch now uses server API instead of client `file://` reads

## [1.1.1] - 2026-04-13

### Added
- Repo-scoped opt-in for Agile workflow + task routing gates
- `npm run repo:scope` CLI to enable/disable workflow per repo
- Default-off scope policy via `hooks/repo-scope.json`

## [1.1.0] - 2026-04-13

### Added
- Ticket-driven work management: every task gets a GitHub issue
- Manager creates tickets before work begins (Epic/Story/Task/Bug/Doc)
- Branch and commit validation gates enforce ticket linkage
- Ticket helper utilities and Manager ticket lifecycle skill
- `npm run ticket:create` command for Scrum-compliant issue creation
- ADR-005: Ticket-Driven Work Management

## [1.0.0] - 2026-04-13

### Added
- Tiered agent architecture research and proposal
- Research findings: 8 topics covering cost optimization,
  model benchmarks, multi-agent patterns, routing rules
- Cynefin-based complexity scoring for tier routing
- Prompt reduction playbook with 8 optimization techniques
- VS Code settings: auto-compact, thinking tool, autopilot,
  code search, git-based file suggestions, request queuing
- Global task router scaffold across instructions, skill,
  classifier script, and hook-backed routing state
- Router dispatcher and smoke-test scripts for lane execution

## [0.1.0] - 2026-04-11

### Added
- Genesis: repo structure, governance files, instructions
- Dashboard scaffold (Alpine.js, health monitoring UI)
- Skills framework with sync/deploy scripts
- Research archive with free-tier inventory
- Device and service inventory (JSON)
- Utility scripts: lint, health-check, sync, deploy
