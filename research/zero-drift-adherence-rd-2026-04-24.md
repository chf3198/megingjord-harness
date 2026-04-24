# Zero-Drift Adherence R&D Baseline (2026-04-24)

Date: 2026-04-24

## Summary Table

| Control Lane | Research Need | Development Need | Verification Gate |
|---|---|---|---|
| Closure integrity | Define mandatory closure evidence fields | Enforce via verifier checks | 0 missing evidence block failures |
| Epic terminality | Define re-scope-before-close protocol | Enforce epic-child terminality checks | 0 closed-epic/open-child failures |
| Ready-SLA discipline | Define blocker-note minimum schema | Detect stale P0/P1 `ready` tickets | 0 stale-ready violations without blocker |
| Queue compatibility | Define required-check naming + queue trigger rules | Check `merge_group` coverage in required workflows | 0 merge-group coverage failures |
| Weekly drift visibility | Define escalation thresholds and report consumers | Emit weekly governance scorecard snapshots | Weekly report exists with recommendations |

## Detailed Findings

1. Zero drift requires both prevention and detection controls; detection-only is reactive.
2. Governance checks must be executable and part of closeout evidence, not narrative-only.
3. Merge queue reliability depends on required workflow trigger compatibility (`merge_group`).
4. Ready-state drift requires age-based SLA with explicit blocker ownership fields.
5. Weekly scorecards create operating cadence for Admin/Consultant gates.

## Recommended Research & Development

1. Research baseline (this artifact) to freeze objective control definitions.
2. Verifier v3 development for:
	- ready-age SLA checks
	- merge-group workflow checks
	- machine-readable remediation hints
3. Weekly governance scorecard development for:
	- failed-check trend visibility
	- ready-SLA violation counts
	- escalation recommendation generation

## Implementation Mapping

- #164: research baseline (complete)
- #161: verifier v3 controls (complete)
- #162: weekly scorecard + snapshots (complete)

## Actionable Next Steps

1. Run verifier before every `review -> done` transition.
2. Generate weekly scorecard and attach output to governance closeouts.
3. Open immediate remediation ticket on any non-zero drift metric.

Last updated: 2026-04-24
