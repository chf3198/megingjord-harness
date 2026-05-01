# Drift Monitoring Strategy (2026-05-01)

**Date:** 2026-05-01
**Scope:** Warn-only stale-instructions monitoring from `npm run docs:lint`.

## Summary Table

| Question | Answer |
|---|---|
| Best install-agnostic path? | **Hybrid reactive-first:** PR annotations + dashboard pull, optional weekly GitHub cron summary |
| Needs always-on scheduler? | No; baseline value is available without scheduler |
| Dashboard placement? | Extend existing **Governance** + **Wiki Health** surfaces, no new top-level panel |
| Fleet utilization fit? | Use free lanes only for optional weekly synthesis (`ollama`/OpenClaw/OpenRouter fallbacks) |
| Recommended now? | Implement reactive baseline first, then optional cron after adoption metrics |

## Findings with Source Links

- `scripts/docs-lint.js` already emits three classes: two CI-fatal drift checks and one warn-only stale-instructions signal; stale is currently hidden unless run manually.
- `instructions/wiki-knowledge.instructions.md` prefers wiki-backed knowledge maintenance and explicit lint/ingest workflows, favoring observable drift loops over silent accumulation.
- `docs/STYLE-GUIDE.md` defines baton/governance language; drift should be reported within governance-facing UX rather than as a disconnected concept.
- `dashboard/index.html` + `dashboard/js/governance-panel.js` + `dashboard/js/wiki-panel.js` already provide panel anchors where stale counts can be surfaced without IA expansion.
- Existing CI cadence (`lint-required` + docs lint patterns) gives a low-coupling surface to show stale warnings in contributor workflows.

## Decision Matrix

Scores: 1 (poor) to 5 (best).

| Pattern | Install-agnostic | Fleet-utilizing | Dashboard-visible | Cost | Complexity |
|---|---:|---:|---:|---:|---:|
| CI-cadence annotations on PRs | 5 | 3 | 3 | 5 | 4 |
| Dashboard pull (`docs-lint --json`) | 4 | 2 | 5 | 5 | 3 |
| Pre-commit hook warnings | 2 | 1 | 1 | 5 | 4 |
| Single tracking issue updater | 4 | 3 | 2 | 4 | 3 |
| GitHub Actions weekly cron summary | 5 | 2 | 3 | 5 | 4 |
| Scheduled fleet agent (36gbwinresource/OpenClaw) | 2 | 5 | 4 | 4 | 2 |

## Recommendation

Adopt a **two-stage hybrid**:

1. **Stage A (default): reactive baseline**
   - Surface stale-instruction warnings as non-fatal PR annotations.
   - Add dashboard pull endpoint returning current stale counts/details on refresh.
   - Keep zero dependency on local cron/systemd/always-on server.
2. **Stage B (optional): weekly summary**
   - Add GitHub Actions schedule that comments on one drift-tracking issue.
   - Use deterministic outputs from `docs-lint` only; no mandatory premium LLM usage.

## Rejection Rationale

- **Fleet-only scheduler as default:** violates install-agnostic property when nodes are offline.
- **Pre-commit-only approach:** misses non-committing stakeholders and central visibility.
- **New standalone dashboard panel:** unnecessary IA growth; duplicates Governance/Wiki surfaces.

## Q4/Q5 Direct Answers

- Q4: Wiki instruction policy and style-guide governance language both favor continuous visible hygiene loops and standardized baton terminology.
- Q5: Extend existing **Governance** (status view) and **Wiki Health/Metrics** (currency view) instead of adding a new top-level panel.

## Actionable Next Steps

1. Spawn implementation ticket: PR annotation path for stale warnings.
2. Spawn implementation ticket: dashboard stale-drift fetch + render in Governance/Wiki sections.
3. Optionally add weekly GH schedule to update one watchlist issue after baseline ships.
4. Measure 30-day stale-count trend before enabling any fleet-scheduled automation.

**Last updated:** 2026-05-01T00:00:00Z
