# Epic #1436 Phase-0 — Worker mid-flight self-anneal recognition + emission
Date: 2026-05-12

## Summary Table
| Topic | Finding |
|---|---|
| Problem | The harness detects Tier-2 recurrence only at nightly cron or via retroactive self-filed tickets. |
| Target behavior | Detect recurrence in-session, signal the active worker, and either auto-emit or prompt confirmation. |
| Best-fit architecture | Hook + event-schema + queue/dashboard surface with Tier-2 proposal generation. |
| Current reuse points | `scripts/global/anneal-event-schema.js`, `scripts/global/anneal-tier2-autofile.js`, `hooks/scripts/goal_lens.py`, `dashboard/js/anneal-queue-panel.js`. |

## Drift Inventory (5-epic sample)
| Epic | Evidence reviewed | Tier-2 gap? |
|---|---|---|
| #1407 | Retroactive Tier-2 tickets #1433/#1434 created only after a user prompt | Yes |
| #1308 | Distributed self-anneal epic; backstop automation exists | No evidence of missed mid-flight emission |
| #1271 | Closeout/reconciliation epic with full issue/PR evidence trail | No evidence of missed mid-flight emission |
| #1298 | Governance-signature epic; unrelated to recurrence handling | No Tier-2 candidate observed |
| #1436 | Target epic itself; no in-session signal path exists today | Gap confirmed |

## Quantified Gap
- Sampled epics with documented Tier-2 miss: 1/5 = 20% epic-level incidence.
- Within the observed #1407 incident, identified recurrence patterns missed in-session: 2/2 = 100%.
- Interpretation: the harness has a real, user-visible in-session awareness gap, but the problem is concentrated in mid-flight detection rather than ticket filing once prompted.

## External Research Dossier
Observed design patterns that are likely transferable:
- callback-driven feedback loops for agent SDKs (prompt submit / tool call / post-step hooks)
- event-schema normalization so old readers continue working while new Tier-2 fields are added
- single-flight + kill-switch guards to prevent duplicate pivots and storm loops
- visible queue surfaces for operator review before auto-filing becomes fully trusted
- prompt-level nudges that convert passive drift sensing into explicit worker awareness

## Existing Signal Inventory
Real harness entry points that can support worker-awareness without greenfield plumbing:
- `scripts/global/anneal-event-schema.js` — v2 event contract, emit/read helpers, backward-compat shim
- `scripts/global/anneal-tier2-autofile.js` — nightly recurrence detector and issue proposer
- `scripts/global/anneal-severity-classifier.js` — existing severity gating for candidate selection
- `scripts/global/anneal-kill-switch.js` — step, rate, and single-flight guards
- `scripts/global/anneal-audit-sensor.js` and `scripts/global/anneal-review.js` — sensor/review layers for trend detection
- `hooks/scripts/goal_lens.py` — prompt hook that can be extended to surface an in-session awareness reminder
- `dashboard/js/anneal-queue-panel.js` — visible queue surface for operators

## Decision Brief
| Option | Pros | Cons | Confidence |
|---|---|---|---|
| 1. Hook-only signal | Lowest latency; integrates at prompt time | Easy to miss if worker ignores the nudge | Medium |
| 2. Hook + queue banner | Signals the worker and the operator | Requires dashboard surfacing and queue state plumbing | High |
| 3. Auto-emit Tier-2 proposal | Eliminates manual discipline gap | Risk of noisy or duplicate tickets if patterns are misclassified | Medium |

## Recommendation
Adopt Option 2 for Phase-1: emit an in-session awareness nudge from the prompt/hook layer and mirror the same candidate into the anneal queue/dashboard. Keep auto-emission behind the existing kill-switch and single-flight gates until the false-positive rate is proven low.

## Last-updated
2026-05-12T00:00:00Z

## Actionable Next Steps
1. File Phase-1 implementation children for hook-side awareness and dashboard surfacing.
2. Add a synthetic test path that reproduces a mid-flight recurrence and verifies a visible signal.
3. Extend the queue/proposal path with an explicit worker-confirmation branch before auto-file.
4. Re-run the audit sample after implementation to confirm the miss rate falls below the baseline.

Signed-by: Cole Mason
Team&Model: claude-code:opus-4-7@anthropic
Role: manager