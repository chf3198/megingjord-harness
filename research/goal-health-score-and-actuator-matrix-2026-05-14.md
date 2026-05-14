# Goal Health Score + Self-Annealing Actuator Matrix

**Date**: 2026-05-14
**Last-updated**: 2026-05-14T14:45:00Z
**Ticket**: #1114 (Phase-0 R&D for Epic #1113)

## Summary table

| Area | Decision | Why |
|---|---|---|
| Score range | 0..100 bounded | Keeps thresholds interpretable and dashboard-friendly |
| Window model | Mixed windows per sensor class | Fast sensors need fast decay; governance trends need longer memory |
| Missing data | Confidence penalty, not hard fail | Prevents false green when sensors are stale |
| Escalation | Cheapest-first global ladder + sensor-local boosts | Preserves cost control while reacting to specific failures |
| De-escalation | Step-down one band per clean window with hysteresis | Avoids oscillation/thrashing |
| Override | `pulse.json` manual override with TTL | Emergency control without permanent drift |

## Detailed findings

### 1) Goal Health Score formula

Let each sensor produce normalized risk $r_i \in [0,1]$, where 0 is healthy and 1 is severe.

$$
\text{Risk} = \sum_i w_i r_i, \quad \sum_i w_i = 1
$$

$$
\text{ScoreRaw} = 100 \cdot (1 - \text{Risk})
$$

$$
\text{Score} = \max(0, \min(100, \text{ScoreRaw} - P_{stale}))
$$

Where $P_{stale}$ is the missing-data confidence penalty:
- 0 if all required sensors are fresh
- 5 if one required sensor stale
- 10 if two+

#### Proposed sensor weights
- Governance audit violations (criticality-weighted): **0.28**
- Label-lint/transition failures: **0.16**
- Consultant closeout failures: **0.18**
- Reopened issue rate (7d): **0.12**
- Merge-evidence violations: **0.10**
- Readability/lint trend regression: **0.08**
- Ticket latency breach (`ready`/`testing` stall): **0.08**

#### Windows
- Fast runtime/governance sensors: 24h EWMA
- Process integrity sensors: 7d rolling
- Stability sensors (reopen, latency): 30d rolling

### 2) Actuator escalation matrix (7 actuators)

Bands:
- **B**: Score >= 80
- **B+**: 60-79
- **B++**: 40-59
- **B+++**: 20-39
- **B++++**: <20

Actuator set:
1. Operator warning banner
2. Mandatory manager checkpoint
3. Mandatory consultant checkpoint
4. Gate strictness raise (advisory -> required)
5. Auto-file anneal ticket
6. Cross-team consult required
7. Change-freeze (except hotfix/governance)

Escalation defaults:
- B: only #1
- B+: #1 #2
- B++: #1 #2 #3 #5
- B+++: #1 #2 #3 #4 #5 #6
- B++++: all actuators (#1-#7)

### 3) De-escalation rules

- Use hysteresis of +8 points above entry threshold before downshift.
- Minimum clean dwell per band before stepping down:
  - from B++++: 14d
  - from B+++: 10d
  - from B++: 7d
  - from B+: 3d
- Step-down only one level at a time.
- Any critical governance breach resets dwell timer.

### 4) Operator override mechanism

`pulse.json` additions:
- `goalTierOverride`: `null | B | B+ | B++ | B+++ | B++++`
- `overrideReason`: string (required when override set)
- `overrideExpiresAt`: ISO timestamp (required)
- `overrideBy`: signer alias

Rules:
- Force-escalate permitted immediately.
- Force-de-escalate allowed max one band lower than computed score.
- Expired override auto-clears.
- All override changes emit event log entries.

### 5) Observability requirements

Outputs:
- `/tmp/governance-audit.json`: per-sensor raw metrics + normalized risk
- `~/.megingjord/goal-tier.json`: current score, band, active actuators, dwell timers
- `pulse.json`: operator override state + expiry

Dashboard surfaces:
- Goal Health Score gauge + 7d sparkline
- Sensor heatmap with stale-data markers
- Actuator ladder panel with current/next transition reason

### 6) Validation scenarios (synthetic)

1. Label-lint burst, clean governance: score should degrade to B+ only.
2. Consultant closeout + governance failures combined: immediate B++/B+++.
3. Missing sensor data only: no catastrophic drop; stale penalty applies.
4. Oscillating threshold crossings: hysteresis prevents band flapping.
5. Panic override to B++++: all actuators active, expiry rollback works.

### 7) Risk register + rollback

- Risk: over-sensitive weights trigger alert fatigue.
  - Mitigation: start with advisory mode; recalibrate after 2 weeks.
- Risk: stale sensors hide true risk.
  - Mitigation: confidence penalty and stale badge.
- Risk: manual override abuse.
  - Mitigation: TTL + signer requirement + immutable log.

Rollback:
- Keep previous scoring config snapshot.
- On instability, freeze at B+ policy baseline and disable auto-escalation #6/#7.

## Source links
- #1114 — Design Goal Health Score and self-annealing actuator matrix
- #1113 — Multi-layer self-annealing goal-governance system
- instructions/workflow-resilience.instructions.md
- scripts/global/megalint/consultant-closeout.js

## Actionable next steps

1. File implementation child ticket: score calculator + JSON emitters.
2. File implementation child ticket: dashboard score + actuator panels.
3. File implementation child ticket: pulse override schema + validation.
4. Run 14-day shadow mode and recalibrate weights before required gating.
