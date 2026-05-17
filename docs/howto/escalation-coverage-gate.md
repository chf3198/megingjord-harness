# Escalation reason telemetry coverage gate

`scripts/global/escalation-coverage-gate.js` (#1797) enforces that ≥95% of escalation events in `logs/cost-telemetry.jsonl` carry a non-empty `escalation_reason`. Without structured reasons, root-cause cost optimization is impossible.

## What counts as an escalation event

Any event in `logs/cost-telemetry.jsonl` whose `outcome` is one of `fail`, `escalated`, or `fallback` (case-insensitive). The set is configurable via `ESCALATION_OUTCOMES` export but rarely needs changing.

## Coverage calculation

```
coverage_pct = (events with non-empty escalation_reason) / (total escalation events) * 100
```

Empty string and null both count as "no reason." Target threshold default 95%, configurable via `MEGINGJORD_ESCALATION_COVERAGE_TARGET` env var.

## Usage

```bash
# Default (last 30 days, 95% target)
npm run governance:escalation-coverage

# Custom window
node scripts/global/escalation-coverage-gate.js --days 7

# JSON output for downstream tooling
node scripts/global/escalation-coverage-gate.js --json

# Tighter target
MEGINGJORD_ESCALATION_COVERAGE_TARGET=99 npm run governance:escalation-coverage
```

Exit code 0 = gate passes (or no escalation events to measure); 1 = coverage below target.

## When the gate fails

The fix is upstream: any caller of `recordCostEvent()` that emits an escalation outcome MUST pass `escalation_reason`. Example from `scripts/global/task-router-dispatch.js`:

```js
const outcome = decision.action === 'fleet-unavailable' ? 'fail' : 'ok';
const escalation_reason = outcome === 'fail' ? (decision.action || 'unknown-escalation') : null;
recordCostEvent(resolved.lane, resolved.providerModelId, { outcome, escalation_reason });
```

Common reason values (informal taxonomy):

- `fleet-unavailable` — fleet target unreachable (Tailscale offline, Ollama down)
- `rate-limit` — paid provider rate limit hit
- `budget-cap` — premium budget governor activated (per #1794)
- `price-cap` — provider exceeded max-price ceiling (per #1796)
- `quality-floor` — output quality below acceptance threshold

Add new values to the informal taxonomy as new escalation paths emerge.

## CI integration

Wire into the same gate suite as other `governance:*` scripts (e.g., `npm run governance:verify`). The gate is currently advisory; promote to required when `soak-replay-runner.js` shows sustained ≥95% coverage across the historical cost-telemetry sample per Epic #1771's replay-based eval pattern. See `docs/howto/soak-to-replay-translation.md` (#1809).

## Tests

`tests/escalation-coverage-gate.spec.js` covers 10 cases including outcome recognition, coverage calculation edge cases (0%, 100%, mixed), top-reason sorting, target threshold edges. Run via `npm run governance:escalation-coverage:test`.

## Related

- Closes #1797 (Epic #1792 G3 cost-minimization wave).
- Composes with: `scripts/global/cost-telemetry.js` (`recordCostEvent` schema source).
- Telemetry baseline: `scripts/global/routing-baseline-report.js`.
