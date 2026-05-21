# Policy Substrate Comparison — Cedar vs Microsoft Agent Governance Toolkit vs Status-Quo JS

> Comparative report for Epic #1962 C5 (#1970 Cedar pilot) + C10 (#1988 MS Toolkit pilot).
> Date: 2026-05-20.
> Pilot phase: **MVP scaffolding shipped**. Full empirical replay-eval (≥100 PRs)
> + dependency installs (Cedar wasm, @microsoft/agentmesh-sdk) deferred to
> Phase-2 follow-ons per the amendment on Epic #1962.

## Substrates evaluated

| Substrate | License | Maturity | Runtime cost (p99) |
|---|---|---|---|
| Status-quo JS (`signer-registry-check.js`) | MIT (internal) | Production | ~0.5ms |
| Cedar (`@cedar-policy/cedar-wasm`) | Apache-2.0 | CNCF Sandbox (Jan 2026) | <0.1ms target |
| Microsoft Agent Governance Toolkit (`@microsoft/agentmesh-sdk`) | MIT | GA Apr 2026 | <0.1ms documented |

## MVP scaffolding deliverables (this PR)

- `inventory/cedar-policies/signer-alias-canonical.cedar` — Cedar policy text mirroring the JS rule set
- `scripts/global/cedar-pilot.js` — pilot harness with `evaluateJs` / `evaluateCedar` / `replayEval` (skeleton, no runtime binding)
- `tests/fixtures/cedar-replay/01..10*.json` — 10 replay-corpus fixtures (canonical, mismatch, signer-independence, edge cases)
- `tests/cedar-pilot.spec.js` — unit tests on the scaffolding

## Comparison matrix (early hypothesis; replay-eval will refine)

| Criterion | JS impl | Cedar | MS Toolkit | Winner (early) |
|---|---|---|---|---|
| Parity with existing JS | 100% | TBD (target ≥99%) | TBD (target ≥99%) | JS |
| Determinism | Mixed | Strong (Cedar design) | Strong (Microsoft claim) | Cedar / MS |
| p99 latency | ~0.5ms | <0.1ms target | <0.1ms documented | MS |
| Maintainability | Familiar JS | New DSL | New SDK | JS |
| Audit-log auto-generation | None | Built-in | Built-in | Cedar / MS |
| Multi-runtime SDK | N/A | wasm (universal) | TS + .NET + Python | MS |
| Edge cases inexpressible in DSL | N/A | Several | Several | JS |

## Phase-2 follow-on tickets (for completion of #1970 + #1988)

- Install `@cedar-policy/cedar-wasm` and replace `evaluateCedar` skeleton with real eval
- Install `@microsoft/agentmesh-sdk` and replace `evaluateMS` (in #1988) with real eval
- Grow `tests/fixtures/cedar-replay/` to ≥100 PRs (current MVP: 10)
- Author the per-substrate edge-case ticket-list (cases the DSLs cannot express)
- Goal-lens override-justified decision: pick canonical substrate based on parity + p99 + maintainability

## Decision (provisional; pending Phase-2 replay-eval)

**Keep JS as canonical until at least ONE pilot achieves ≥99% parity on ≥100 PRs AND p99 perf advantage ≥5x AND maintainability holds.** Either Cedar or MS Toolkit could win; the comparative spike + corpus-grown replay-eval will decide empirically.

## References

- Epic: #1962
- C5 ticket: #1970
- C10 ticket: #1988
- Cedar CNCF Sandbox: infoq.com/news/2026/01/cedar-joins-cncf-sandbox
- AWS AgentCore Cedar precedent: byteiota.com/aws-policy-agentcore-cedar-language-secures-ai-agents
- Microsoft Toolkit: github.com/microsoft/agent-governance-toolkit
- Cedar docs: docs.cedarpolicy.com
