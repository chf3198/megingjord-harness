# Changelog

## [Unreleased]

### Added
- **Model routing agents**: 8 custom agents with pinned models
  override AUTO (ADR-004). Router → Architect (Opus), Implementer
  (Sonnet), Quick (GPT-5 mini), Planner (Opus), 4 audit agents
- **VS Code settings**: planAgent→Opus, implementAgent→Sonnet,
  inlineChat→Sonnet; agents/ dir with deploy/sync support

## [1.5.0] - 2026-04-13

### Fixed
- **x-if architecture**: Resources/Help use `<template x-if>` for true DOM removal;
  Ops uses `x-show` to eliminate CLS on default view
- **HTML escaping**: `esc()` now covers `"`, `'`, backtick (XSS hardening)
- **Tooltips pure Alpine**: `activeTip` reactive state replaces imperative DOM
- **CDP tests substantive**: `Runtime.getHeapUsage`, DOM nodes, TaskDuration,
  LayoutCount assertions; x-if panel-removal verification test
- **CLS/perf**: `x-cloak`, `content-visibility:auto`, preconnect, deferred CDN
  scripts; Lighthouse median 85-87 (was 82-83), `rel="noopener"` on links

## [1.4.0] - 2026-04-13

### Added
- Half-screen optimized UX target (960×1080) with responsive view tabs
- Multi-view dashboard organization (Ops, Resources, Help) to reduce active DOM
- Optional contextual tooltip system with "More info" links into Help view
- Built-in quick stress test button (12 lightweight rounds, ~1 minute)
- Expanded Playwright E2E checks for view switching, tooltips, and test runner
- Google-tooling quality suite via Playwright CDP metrics (`test:quality`)

### Changed
- Dashboard config now persists tooltip preference
- Panel renderers now include explicit empty/fallback states for reliability

### Validation
- Lighthouse audit (`test-results/lighthouse-dashboard.json`):
    - Performance 83
    - Accessibility 100
    - Best Practices 96
    - SEO 90

## [1.3.0] - 2025-07-16

### Added
- Visual QA governance gate: `git tag` blocked on web repos until visual inspection recorded
- `visual_qa_record.py` helper to record inspection evidence in governance state
- `visual-qa-governance.instructions.md` mandating visual QA for web releases
- EPIC-002: Visual QA self-annealing (diagnosis, research, enforcement)
- ADR-006: Visual QA gate for web releases

### Fixed
- `state_store.py` deep-merge: new governance fields now propagate to existing state files
- `repo_detection.py`: repos with `package.json` + HTML/CSS now correctly classified as `website-static`

### Changed
- `pretool_guard.py`: added `git tag` denial gate for web repos without visual QA
- `stop_checks.py`: added `visual_qa` to admin completion checklist for web repos
- `admin_patterns.py`: added `RE_GIT_TAG` regex pattern

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
- Ticket-driven work management: GitHub issue per task, branch/commit gates
- `npm run ticket:create` for Scrum-compliant issue creation (ADR-005)

## [1.0.0] - 2026-04-13

### Added
- Tiered agent architecture, Cynefin complexity scoring, prompt reduction
- Global task router: instructions, skill, classifier, hook-backed routing
- VS Code settings: auto-compact, thinking tool, autopilot, code search

## [0.1.0] - 2026-04-11

### Added
- Genesis: repo structure, governance, dashboard, skills framework
- Research archive, device/service inventory, utility scripts
