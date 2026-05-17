# Provider price-cap gate

`scripts/global/provider-price-cap-gate.js` (#1796) enforces a per-request maximum-cost ceiling for paid routes (`haiku`, `premium`). Closes Epic #1792 child. Composes with #1797 escalation-reason taxonomy: `escalation_reason: "price-cap"` for blocked attempts; `"price-cap-override"` when explicit override approved.

## Default caps

| Lane | Default cap | Env override |
|---|---:|---|
| `free` | none (∞) | — |
| `fleet` | none (∞) | — |
| `haiku` | $0.05 | `MEGINGJORD_PRICE_CAP_HAIKU` |
| `premium` | $0.25 | `MEGINGJORD_PRICE_CAP_PREMIUM` |

Defaults are placeholders calibrated against the 30-day premium-share governor (#1794). Tighten/loosen via env when operator-specific budget allows.

## CLI usage

```bash
# Allow check (exit 0 = allow; exit 1 = blocked)
node scripts/global/provider-price-cap-gate.js --lane premium --cost 0.20

# Blocked
node scripts/global/provider-price-cap-gate.js --lane premium --cost 0.30

# Override an over-cap request
node scripts/global/provider-price-cap-gate.js --lane premium --cost 0.30 --override

# JSON output for downstream tooling
node scripts/global/provider-price-cap-gate.js --lane premium --cost 0.30 --json
```

## Module API

```js
const { evaluate } = require('./scripts/global/provider-price-cap-gate');
const decision = evaluate({ lane: 'premium', model: 'claude-opus-4-7', estimatedCostUsd: 0.30 });
// → { allow: false, over_cap: true, escalation_reason: 'price-cap', ... }
```

Output shape:

```json
{
  "allow": false,
  "lane": "premium",
  "model": "claude-opus-4-7",
  "estimated_cost_usd": 0.30,
  "cap_usd": 0.25,
  "over_cap": true,
  "override_used": false,
  "escalation_reason": "price-cap",
  "policy_version": "2026-05-17"
}
```

## Telemetry integration

When CLI mode and a decision crosses the cap, `recordTelemetry()` appends to `logs/cost-telemetry.jsonl` with the appropriate `escalation_reason`, feeding the #1797 coverage gate. Module-API callers should invoke `recordTelemetry(decision)` explicitly if telemetry is desired.

## Override semantics

An explicit operator override (`--override` flag OR `evaluate({override: true})`) flips the decision to `allow=true` AND sets `escalation_reason: "price-cap-override"`. Auditable: future audit can query for override usage trends.

Use only when the high-cost call is genuinely necessary (e.g., security audit, frontier-reasoning required). Operator records rationale in baton artifact.

## Composition

- **Epic #1792** (G3 cost-minimization wave) — this gate is one of the cluster (#1793 cache-hit, #1794 premium-budget-governor, #1795 batch-routing, #1796 this ticket, #1797 escalation-coverage).
- **#1797 escalation-coverage** — emits `escalation_reason: "price-cap"` so the coverage gate counts these events.
- **`scripts/global/model-routing-policy.json`** — source of truth for per-lane `costPer1kTokens`; can derive cap values from `cap = costPer1kTokens × max_tokens_per_request`.

## Future enhancements (out of #1796 scope)

- Per-provider caps (currently per-lane only).
- Dynamic caps reading recent rolling spend (today they are constants).
- Integration with `wrapProviderCall` in HAMR wrapper to enforce pre-call.

## Tests

`tests/provider-price-cap-gate.spec.js` — 10 cases covering free/fleet ∞-cap, haiku at/under/over cap, premium block + override, boundary at cap-equal, unknown-lane fallback, output shape, determinism.

Run via `npm run governance:price-cap:test`.

## Related

- Closes #1796 (Epic #1792 G3 child).
- Composes with #1797 escalation-coverage gate.
- See `docs/howto/escalation-coverage-gate.md` for the broader telemetry coverage contract.
