# Cost→Quality Self-Anneal Research (2026-04-23)

Date: 2026-04-23

## Summary Table

| Lever | Evidence | Cost Impact | Quality Impact | Recommendation |
|---|---|---|---|---|
| Path-scoped CI triggers | GitHub Actions `paths` filters | Run fewer irrelevant workflows | Neutral-positive if required checks stay mapped | Adopt with required-check guardrails |
| Concurrency cancellation | GitHub `concurrency` + `cancel-in-progress` | Cuts superseded runs | Positive (freshest commit signal) | Adopt per workflow/ref |
| Dependency caching | `actions/cache` docs and key strategy | Reduces repeated install minutes | Neutral-positive (faster feedback) | Adopt with stable keys + restore keys |
| Test targeting | Playwright `--only-changed`, project filters | Runs smaller test set by default | Positive if full suite still runs on merge/nightly | Add PR-fast lane + full-gate lane |
| Lint incrementalization | ESLint `--cache`, `--cache-strategy content` | Reduces repeated lint CPU/runtime | Neutral | Enable cache in local/CI lint paths |
| Model routing discipline | Local `inventory/ai-models.json` + usage log | Reduces premium-request burn | Positive if escalation criteria are explicit | Enforce tiered model routing |

## Current Baseline (Repo Evidence)

- `logs/copilot-usage.json` shows manual override: 1,090 requests and $60.38 month-to-date.
- `inventory/ai-models.json` documents 0x, 0.25x, 0.33x, 1x, 3x, and 7.5x model tiers.
- Prior run quality was high, but cost efficiency rating was 8.4/10 (session critique).

## Web Findings (Corroborated)

1. GitHub Actions billing is per-runner-minute and runner type; Linux is cheaper than Windows/macOS for hosted runners.
   Source: https://docs.github.com/en/billing/concepts/product-billing/github-actions
2. Path/branch filters and event narrowing reduce unnecessary workflow execution.
   Source: https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax
3. Concurrency groups can cancel stale in-progress runs and prevent duplicate spend.
   Source: https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency
4. Dependency caches materially reduce repeated setup cost; poor keys can cause thrash.
   Source: https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching
5. Playwright supports selective execution (`--only-changed`, `--project`, `-g`) for fast PR feedback.
   Source: https://playwright.dev/docs/test-cli
6. ESLint supports file-change caching (`--cache`) and content strategy for stable cache hits.
   Source: https://eslint.org/docs/latest/use/command-line-interface

## Cost-Benefit Analysis

Assumptions for near-term anneal cycle:
- 1,090 monthly requests baseline.
- Shift 35% of current 1x-equivalent requests to 0.33x tier (no quality regression for routine tasks).
- Reduce avoidable CI minutes by 20% via path filters + concurrency + caching.

Estimated effects:
- Model-routing savings factor on shifted segment: $1 - 0.33 = 67\%$.
- Total request-cost savings: $0.35 \times 0.67 \approx 23.45\%$.
- From $60.38 baseline, projected monthly reduction: $60.38 \times 0.2345 \approx $14.16.
- CI minute/storage savings depend on repo plan and runner mix; risk-adjusted estimate: 10–20% Actions overage reduction.

## Smart Plan Confidence

Confidence is operationally **high** (expert-plan grade) because all levers are first-party documented and low-risk when gated.
This is not a guarantee of exact dollar outcome; it is a high-confidence optimization plan with measurable checkpoints.

## Actionable Next Steps

1. Implement model-routing policy + telemetry guardrails (task ticket).
2. Implement CI selective execution/caching/concurrency hardening (task ticket).
3. Implement weekly anneal scorecard to measure cost, latency, pass-rate, and rollback if quality drops.

Last updated: 2026-04-23
