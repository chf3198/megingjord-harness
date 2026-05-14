# Epic #1427 Phase A-C Completion — Token Spend Controls
Date: 2026-05-12

## Summary Table
| Phase | Delivered | Evidence |
|---|---|---|
| A | Prompt compaction and context scoping in dispatch path | `scripts/global/token-spend-controls.js`, `scripts/global/task-router-dispatch.js`, `tests/token-spend-controls.spec.js` |
| B | Dispatch cache and repeat-request dedup | `scripts/global/token-spend-cache.js`, `scripts/global/task-router-dispatch.js`, `tests/token-spend-cache.spec.js` |
| C | Service/session token telemetry, recurring scorecard, quality rollback hook | `scripts/global/cost-telemetry.js`, `scripts/global/token-spend-report.js`, `scripts/global/model-routing-engine.js`, `package.json` |

## Detailed Findings
- Dispatch now compacts repeated prompt lines and applies lane-scoped prompt budgets before fleet calls.
- Dispatch now resolves a scoped context tier and records tier metadata into cost telemetry.
- Repeat fleet requests now use a deterministic cache key and reuse recent responses to avoid duplicate spend.
- Cost telemetry now records service/session class, cache-hit state, and prompt raw-vs-sent sizes for measurable savings.
- New token scorecard script combines cost summary, cache-hit gate, and quality parity outcome in one report.
- Quality parity failure now writes a rollback override (`force_lane: premium`) consumed by routing resolution.

## Validation
- Unit tests passed:
  - `tests/token-spend-controls.spec.js`
  - `tests/token-spend-cache.spec.js`
  - `tests/constitution-compressor.spec.js`
- Smoke tests passed:
  - `node scripts/global/task-router-dispatch.js --prompt 'summarize docs quickly' --json`
  - `node scripts/global/token-spend-report.js --no-rollback`

## Last-updated
2026-05-12T00:00:00Z

## Actionable Next Steps
1. Run `npm run cost:token-report` on a schedule to monitor budget, cache gate, and parity readiness.
2. Tune lane-level prompt budgets after one week of telemetry deltas.
3. Add dashboard tiles for `promptReductionPct` and `cacheHitPct` from `logs/token-spend-report.json`.

Signed-by: Soren Mason
Team&Model: copilot:claude-sonnet-4-6@github
Role: collaborator