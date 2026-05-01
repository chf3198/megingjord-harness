---
title: "Release Gate: Browser-Load and Concurrency Smoke Tests"
ticket: "#524"
epic: "#380"
date: 2026-05-01
author: "Aria Mason"
team_model: "claude:claude-sonnet-4-6@anthropic / 36gbwinresource:qwen2.5-coder:7b"
role: consultant
---

# Release Gate: Browser-Load and Concurrency Smoke Tests

Research ticket #524 — findings for epic #380 implementation.

Fleet analytical contribution: 36gbwinresource (`qwen2.5-coder:7b`, GPU) used for
release-gate design synthesis.

## 1. Minimum Viable Browser/Network Gate (AC 1)

**Finding**: `tests/no-network-errors.spec.js` (59 lines) already implements 4 of the 5
required checks. The critical gap is that this test is **not included in `quality-gates.yml`**
and therefore does not block PRs or releases today.

| Check | Status | Location |
|---|---|---|
| Zero `ERR_CONNECTION_RESET` / `ERR_FAILED` on load | ✅ exists | `no-network-errors.spec.js` test 1 |
| All CSS/JS assets return HTTP 200 | ✅ exists | `no-network-errors.spec.js` test 2 |
| Concurrent asset load completes in <2000ms | ✅ exists | `no-network-errors.spec.js` test 3 |
| Context Flow SVG legible at 725px viewport | ✅ exists | `no-network-errors.spec.js` test 4 |
| Dashboard core panels render (h1, #panel-baton, #panel-activity) | ✅ exists | `dashboard.spec.js` tests 1-2 |
| Critical API endpoints return 200 | ❌ missing | needs `/api/health`, `/api/wiki-pages`, `/api/devices` |

The **minimum viable gate** is:
1. Add `tests/no-network-errors.spec.js` to the `quality_required` job in
   `.github/workflows/quality-gates.yml`
2. Add `tests/dashboard.spec.js` (loads + panel visibility) to the same job
3. Add a new `tests/api-smoke.spec.js` (3-5 critical API endpoints return 200)

## 2. Concurrency Smoke-Test Threshold (AC 2)

**Existing threshold**: 7 parallel `GET` requests to static assets, max 2000ms total.
This is a good event-loop-blocking detector but under-covers the API layer.

**Recommended threshold for release gate**:

| Scope | Parallel requests | Max total time | Rationale |
|---|---|---|---|
| Static assets (CSS/JS) | 7 (existing) | 2000ms | Event-loop blocking detection |
| Critical API endpoints | 5 concurrent | 3000ms | `/api/health`, `/api/wiki-pages`, `/api/devices`, `/api/metrics`, `/api/events` |
| Combined burst | 12 mixed | 4000ms | Simulates real page load (static + API in parallel) |

**Tooling recommendation**: Use Playwright `APIRequestContext.get()` in parallel
(`Promise.all`) — same pattern as the existing concurrent test. No additional tooling needed.

The 5-endpoint threshold is conservative; this is a single-server local app, not a
distributed system. The goal is to detect event-loop hangs, not load-test capacity.

## 3. Where Governance Should Block (AC 3)

**Both merge gate AND release-tag step, for different reasons.**

### Current gap
`release-please.yml` runs on push to `main` and creates release PRs with **no test gate**.
Once a release PR is merged, `release-please-action` creates a tag — no verification step.
This means broken code can be released even if it was caught by quality-gates before merge
(e.g., a commit that lands via a merge group race condition).

### Recommendation

**At PR merge** (existing, extend):
- `quality-gates.yml` already blocks on unit tests + router smoke
- Add `no-network-errors.spec.js` and `dashboard.spec.js` here to catch browser-load
  regressions before they reach main

**At release tag** (new, add):
- Add a `release-verification` job that fires on `release:published` or on the release-please
  PR merge trigger
- Run the full browser + API smoke suite against a live server started in CI
- Block the release GitHub Action from completing if any smoke test fails

**Decision boundary**:

```
PR merge gate    → prevents regressions from landing in main
Release tag gate → final safety net for release artifacts
```

The merge gate has the lowest latency for developer feedback. The release-tag gate is the
last line of defense before artifacts are published. Both are required because:
1. Squash merges can pass CI individually but interact badly with previous commits
2. Release-please PR merges bypass the normal PR gate (they are automated)

## 4. Recommended Epic #380 Child Tickets

Based on this research, epic #380 should be decomposed into:

1. **Add browser + dashboard tests to quality-gates.yml** — low risk, no new code, wires
   existing tests into the merge gate
2. **Add `tests/api-smoke.spec.js`** — 3-5 API endpoint smoke tests, <50 lines
3. **Add release-verification job to release-please pipeline** — moderate risk (touches
   `.github/workflows/release-please.yml`)

Tickets 1 and 2 are safe from Copilot conflicts (test file + workflow gate extension).
Ticket 3 touches `release-please.yml` — coordinate with Copilot team before that PR.

## 5. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| `no-network-errors.spec.js` needs running server → CI slower | Low | Already handled by `webServer` in `playwright.config.js` |
| API endpoints may not be stable in CI (cold start) | Low | Add `waitForTimeout(1000)` after server start; already done for other tests |
| Release-tag job adds 2-3min to release cycle | Low | Acceptable; release cadence is low-frequency |
| `.github/workflows/` conflict with Copilot team | Medium | Tickets 1-2 touch only quality-gates.yml; coordinate ticket 3 |
