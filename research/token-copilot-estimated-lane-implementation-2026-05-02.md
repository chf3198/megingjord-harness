# Copilot Estimated-Lane Telemetry + Caveat Reporting Implementation (Ticket #772)

Date: 2026-05-02
Last-updated: 2026-05-02T06:56:00Z

## Summary Table

| Item | Result |
|---|---|
| Ticket | #772 |
| Scope | Copilot estimated-lane normalization + caveat surfaces |
| Code status | Implemented |
| Tests | 22 passed (targeted suite) |
| Lint/governance | `npm run lint` PASS, `npm run governance:no-sync-http` PASS |
| Fleet/cloud evidence | OpenClaw health+chat, 36gbwinresource benchmark, provider probes |

## What changed

1. Canonical ledger now carries caveat metadata fields (`caveat_code`, `caveat_detail`).
2. Provider adapter layer now includes a `copilot` adapter that always marks confidence as `estimated` and emits explicit caveat text.
3. Telemetry summaries now expose confidence split (`exact`, `estimated`, `other`).
4. Weekly report includes confidence split delta to show exact-vs-estimated drift over time.
5. Cost report prints confidence split and explicit non-exactness caveat when estimated entries exist.
6. Copilot tracker exports `getCopilotEstimatedRecord()` for canonical estimated-lane record projection.
7. Tests extended for Copilot adapter, schema confidence validation, confidence summary output, and tracker caveat export.

## Validation Evidence

### Fleet / OpenClaw / 36gbwinresource

- `node scripts/global/openclaw-preflight.js` => tailscale OK, openclaw OK.
- `OPENCLAW_URL=$(node -e "console.log(require('./scripts/global/fleet-config').getOpenClawURL())") node scripts/global/openclaw-chat.js --health --json` => `{ "ok": true, "healthyCount": 1 }`.
- `OPENCLAW_URL=... node scripts/global/openclaw-chat.js --prompt ... --model qwen2.5-7b --json` => successful completion with usage payload.
- `node scripts/global/fleet-benchmark-runner.js --out test-results/fleet-benchmark-772.json`:
  - `36gbwinresource`: warm run `tok_s` ~73.41, latency 1768 ms.
  - `windows-laptop`: warm run `tok_s` ~7.25.
  - `penguin-1`: memory-constrained (documented as expected guardrail signal).

### Cloud Provider Probes

- `node scripts/global/capability-probe.js` + `node scripts/global/capability-show.js` reported active provider reachability for:
  - OpenRouter
  - Google AI Studio
  - Groq
  - Cerebras
  - (also Anthropic/OpenAI)

## Acceptance Criteria Mapping (#772)

- Copilot records in unified ledger with estimated confidence: **Met**.
- Reporting separates exact vs estimated lanes: **Met**.
- No false exact Copilot claim: **Met** (explicit caveat strings in adapter/reports/tracker projection).
- Lint/tests pass for touched paths: **Met**.

## Actionable Next Steps

1. Wire `getCopilotEstimatedRecord()` into periodic ledger append flow if monthly-level records should be auto-ingested.
2. Add dashboard card for confidence split trend from `model-routing-weekly.json`.
3. Add recurring probe snapshot retention for provider status drift analysis.

## Team&Model

- Human alias: curtisfranks
- Team&Model: GitHub Copilot + GPT-5.3-Codex
- Date: 2026-05-02
