# Epic #1113 Phase-0 — Multi-layer self-annealing goal-governance design

**Date**: 2026-05-09 · **Lane**: docs-research · **Author**: Cole Mason (claude-code:opus-4-7) · **Test strategy**: peer-review

## 1. Goal Health Score (GHS) formula

```
GHS = clamp01(1 - Σ(w_i · failure_rate_i))    where Σ w_i = 1
```

Single 0–1 scalar. 1.0 = perfect. <0.8 escalates first actuator. <0.5 escalates further. Computed in `governance-audit.js` per existing `hamr-utilization-sensor` pattern (#1153).

## 2. Sensor weighting (6 sensors, 7d rolling)

| Sensor | w | Source | failure_rate definition | Null-handling |
|---|---|---|---|---|
| governance-audit violations | 0.25 | `/tmp/governance-audit.json` count + severity | `min(1, weighted_count / 14_per_week)` | `null` if file missing → exclude from Σ; renormalize w |
| label-lint failures | 0.15 | `gh api workflows/label-lint runs` | `failed_runs / total_runs` | `null` if no runs in window → exclude |
| Consultant goal-misorder findings | 0.20 | `gh api search` for `CONSULTANT_CLOSEOUT` body matching `goal-misorder` or `goal-priority-violation` | `flagged / total_closeouts` | `null` if 0 closeouts → exclude |
| PR review goal-mentions | 0.10 | PR review comments matching `goal-lens|goal-priority` | `flagged / total_PRs_with_review` | `null` → exclude |
| Reopened-with-priority-cause | 0.20 | `gh issue list --state reopened` filtered by recent CONSULTANT_CLOSEOUT root cause | `priority_reopens / total_reopens` | `null` → exclude |
| Operator override flag | 0.10 | `~/.megingjord/operator-flags.json` `goal_governance_failing: true` | binary 0/1 | `null` if file missing → 0 |

**Renormalization rule**: when sensors return null, recompute weights over the active subset so Σ w_remaining = 1. Avoids penalizing missing data.

## 3. Actuator escalation matrix (7 actuators)

| Actuator | Threshold (GHS<) | Escalation action | De-escalation source |
|---|---|---|---|
| A1: tier ladder in `goal_lens.py` | 0.80 / 0.65 / 0.50 / 0.35 | step B → B+ → B++ → B+++ → B++++ | when GHS recovers + 30d below trigger |
| A2: CI gate hardening | 0.70 | drift-lint advisory → required | 30d zero `drift-lint` failures |
| A3: COLLABORATOR_HANDOFF goal-tradeoff block | 0.65 | mandatory section in handoff | 14d zero goal-misorder findings |
| A4: Consultant role mandatory (no N/A) | 0.55 | block "consultant: N/A" closeouts | 30d zero goal-related Consultant flags |
| A5: Operator notification | 0.60 | post specific tickets to mailbox | manually ack via override |
| A6: Session-context reminder | 0.75 | inject `wiki/concepts/harness-goals.md` link in UserPromptSubmit | 14d clean for affected role |
| A7: workflow-self-anneal auto-trigger | 0.45 | invoke skill on PR open | 7d zero recurring patterns |

**Constraint satisfied**: each actuator's de-escalation is independent of the others. A2 can de-escalate while A4 is still escalated, etc.

## 4. Per-actuator de-escalation state

Stored at `~/.megingjord/goal-tier-state.json`:

```json
{
  "ghs_7d": 0.82,
  "ghs_history": [{"ts": "...", "value": 0.82}],
  "actuators": {
    "A1": { "tier": "B+", "escalated_at": "2026-04-15T...", "deescalation_eligible_at": "2026-05-15T..." },
    "A2": { "level": "advisory", "escalated_at": null, "deescalation_eligible_at": null },
    "A3": { "level": "off", ... },
    ...
  }
}
```

Per-actuator timer: each escalation records `escalated_at`; de-escalation runs only after window elapsed AND sensor signal clean.

## 5. Operator override path

Two override types:

- **Force-escalate**: `node scripts/global/goal-tier-override.js --actuator A4 --tier strict --reason "..." --until 2026-06-01`
- **Force-de-escalate**: `node scripts/global/goal-tier-override.js --actuator A1 --reset --reason "..."`

Persisted to `~/.megingjord/operator-overrides.json` with audit trail (timestamp + reason + ttl). Visible in dashboard #1159.

## 6. AC2–AC7 implementation acceptance specs

### AC2 (this session)

- `governance-audit.js` computes GHS via new module `scripts/global/goal-health-score.js`
- Emits to `/tmp/governance-audit.json.goal_health` block: `{score, contributing_sensors, weights_used, ts}`
- `/quota` schema bumps to v4 with `goal_health_score_7d` field (additive; null-guarded)
- Tests: pure-function GHS calculator with synthetic sensor inputs
- Test strategy: tdd-pyramid

### AC3 (sensor wiring)

- Each of the 6 sensors has its own pure-function module returning `{value: 0..1 | null, evidence: [...]}`
- All 6 wired into `goal-health-score.js`
- Tests: each sensor unit-tested with fixture inputs

### AC4 (actuator wiring)

- Each of 7 actuators is a pure function: `(ghs, state, sensor_values) → action | null`
- Action engine module reads state, applies escalations, persists state
- Tests: each actuator unit-tested with synthetic GHS thresholds

### AC5 (B/B+/B++/B+++/B++++ tier ladder)

- Extends D-009 from #1103. Tier file at `inventory/goal-tier-current.json`
- `goal_lens.py` reads tier; injects context per tier level
- Test strategy: tdd-pyramid (Python pytest)

### AC6 (dashboard + state files)

- `~/.megingjord/goal-tier.json` + `pulse.json` updated by action engine
- Dashboard panel reads files, renders tier + per-actuator state
- Test strategy: visual-regression (matrix-prescribed for dashboard)

### AC7 (override path)

- `goal-tier-override.js` CLI + persistence + governance-audit integration
- Test strategy: tdd-pyramid

## 7. Constraints satisfied

- ✅ No single point of failure: 6 sensors + 7 actuators, decoupled
- ✅ Per-actuator de-escalation: each has its own window + signal
- ✅ Per-actuator state observable + operator-overridable
- ✅ G1 > G3: design accepts cost increase for full B++++ tier per Epic body

## 8. Risks + mitigations

- **Sensor false-positive cascade**: if one sensor mis-counts, GHS drops, all 7 actuators escalate. *Mitigation*: each actuator has independent de-escalation and operator override.
- **Operator override abuse**: force-de-escalate could mask real failures. *Mitigation*: audit trail + ttl required.
- **Renormalization gaming**: if 5 of 6 sensors return null, the 6th carries 100% weight. *Mitigation*: floor `Σ w_active ≥ 0.5` or GHS reports `stale: true`.
