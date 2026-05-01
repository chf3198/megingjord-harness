---
title: "Drift Monitoring Strategy 2026-05-01"
date: 2026-05-01
status: ingested
tags: [docs-drift, governance, dashboard]
---

# Drift Monitoring Strategy 2026-05-01

## Summary Table

| Dimension | Decision |
|---|---|
| Default approach | Reactive-first (PR annotations + dashboard pull) |
| Optional augmentation | Weekly GitHub cron summary comment |
| Dashboard placement | Governance + Wiki Health/Metrics |
| Fleet requirement | Optional only (not baseline dependency) |

## Key Findings

1. `docs-lint` already detects stale instructions; the gap is visibility.
2. Install-agnostic design rejects mandatory cron/systemd/always-on dependencies.
3. Existing dashboard governance/wiki surfaces can absorb drift status.
4. Fleet scheduling can be useful, but only as a non-required optimization.

## Decision Matrix Outcome

Top path: **Hybrid two-stage model**.

- Stage A: reactive baseline visible in PR and dashboard refresh loops.
- Stage B: optional weekly issue update for trend monitoring.

## Actionable Next Steps

1. Create implementation issue for PR stale-warning annotations.
2. Create implementation issue for dashboard drift subsection.
3. Add optional weekly watchlist issue automation after baseline adoption.
4. Review stale trend over 30 days before enabling fleet-scheduled jobs.
