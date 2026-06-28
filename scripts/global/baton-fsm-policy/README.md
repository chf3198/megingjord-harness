# baton-fsm-policy — Policy-as-Code Substrate

Refs #3286, Epic #3284. Absorbs #1297.

## Architecture

Two evaluation tiers, one decision:

- **Default: pure-JS policy-substrate** — zero infrastructure required.
  `evaluatePolicy(state, event, evidenceMask)` returns the same decision
  as `kernel.decide()` plus a full `decision_log` (ordered rule-by-rule
  audit trail). No OPA, no sidecar, no binary dependency.

- **Opt-in: OPA sidecar** — pass `{ sidecar: true }` to `evaluate()`.
  When the `opa` binary is on PATH, the Rego policy (`baton-policy.rego`)
  is evaluated in parallel for parity verification. When absent, falls
  back to the JS substrate with a clear advisory (never silent skip).

## Usage

```js
const { evaluate } = require('./baton-fsm-policy');

// Default: pure-JS, zero infra
const result = evaluate('triage', 'MANAGER_HANDOFF', evidenceMask);
// result.decision_log shows every rule evaluated

// Opt-in sidecar
const checked = evaluate('triage', 'MANAGER_HANDOFF', evidenceMask, { sidecar: true });
// checked.sidecar_advisory present when opa absent
```

## Files

| File | Purpose |
|---|---|
| policy-substrate.js | Decision-logged JS evaluator (Rego-equivalent) |
| baton-policy.rego | OPA/Rego policy (self-hosted tier) |
| opa-sidecar.js | OPA binary wrapper + parity checker |
| index.js | Public API with opt-in sidecar routing |
