# EPIC-001: Dashboard Revamp — World-Class Fleet Dashboard & Config Tool

**Owner:** DevEnv-Ops
**Target release:** v1.2.0
**Status:** Proposed
**Date:** 2026-04-13

## Objective
Deliver a world-class, secure, accessible, and extensible fleet dashboard and configuration tool that provides actionable observability, safe configuration controls, and an excellent UX for both novice and expert operators.

## Phases

1. Discovery & Standards (Research)
   - Survey best practices: accessibility (WCAG), observability signals (metrics/traces/logs), dashboard UX, security for config UIs, and deployment patterns (proxying sensitive keys server-side).
   - Output: short research summary + checklist.

2. Data & APIs (Backend)
   - Ensure secure server-side proxies for fleet APIs, local state file aggregation, and credentials isolation.
   - Add `/api/router/metrics`, `/api/fleet/...` proxies, quota endpoints.
   - Acceptance: backend serves JSON for all dashboard views.

3. Core UX & Visual Design (Frontend)
   - Mobile-first layouts, theme support, responsive grids, clear status badges, drilldowns, and action affordances (refresh, run health, open logs).
   - Accessibility: semantic HTML, ARIA labels, keyboard navigation, color contrast.
   - Acceptance: Lighthouse accessibility score >= 90.

4. Observability & Alerts
   - Expose key metrics (latency, error rate, model usage, quota burn), provide thresholds, and allow configuring alert channels.
   - Acceptance: testable thresholds and sample alerting pipeline (webhook stub).

5. Configuration UX & Safety
   - Safe config editors with validation, preview, and rollback, backup before apply, dry-run mode.
   - Acceptance: `npm run deploy` dry-run and `deploy:apply` backup behavior validated.

6. Testing & Hardening
   - Add Playwright visual/E2E tests, accessibility checks, security linting, and performance budget checks.
   - Acceptance: E2E tests pass locally; lint passes.

7. UAT & Release
   - Run UAT checklist, fix issues, release v1.2.0 with changelog and migration notes.

## Deliverables
- Research summary doc
- Server API endpoints for dashboard consumption
- Refreshed UI components and CSS variables for theming
- Playwright E2E tests for core flows
- Documentation: README & user guide for enabling fleet features

## Acceptance Criteria
- Dashboard renders device list, services, quotas, live stats, router lanes reliably
- All API calls served from `scripts/dashboard-server.js` (no client-side file reads)
- Playwright tests validate presence of panels and key controls
- Accessibility and security checks run in CI

## Initial Tasks
- T1: Add `/api/router/metrics` endpoint (done)
- T2: Update client to use endpoint (done)
- T3: Add Epic doc (this file)
- T4: Add Playwright test scaffold (next)

*** End EPIC ***
