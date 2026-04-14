# Changelog

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
- Dashboard revamp epic, router metrics API, settings panel
- Accessibility: skip-link, focus-visible, dark-safe router
- Playwright E2E tests with screenshot artifacts

## [1.1.1] – Repo-scoped Agile workflow opt-in
## [1.1.0] – Ticket-driven work: issue per task, branch/commit gates
## [1.0.0] – Tiered agent architecture, Cynefin scoring, global task router
## [0.1.0] – Genesis: repo structure, governance, dashboard, skills
- Research archive, device/service inventory, utility scripts
