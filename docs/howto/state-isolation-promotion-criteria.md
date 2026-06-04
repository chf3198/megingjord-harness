# State-Isolation Promotion Criteria (advisory → required)

Epic #2091 C10. Defines when the state-isolation fix-set (C1–C8) graduates from
**advisory** to **required** (blocking). Replay-eval-gated, never calendar-gated
(per `feedback_calendar_thresholds_in_agentic_systems` / Epic #1771 #1827).

## Current posture

- C1–C6 (keying, session hooks, canonical-main enforcer) are **operational** and load-bearing.
- C7 audit + C8 replay-eval are **advisory** signals at ship time.

## Promotion gate (Consultant authority)

The fix-set is promoted to **required** only when ALL hold:

1. **Replay-eval precision** — the C8 replay-eval (`state-isolation-replay-eval.js` against
   the pollution corpus) reports **zero false-positives** across **≥ 2 consecutive** harness
   weeks of accumulated session data (velocity-relative, not a fixed date).
2. **Audit coverage** — `~/.megingjord/state-isolation.jsonl` shows session-start **and**
   session-end events for ≥ 95% of sessions in the window (no silent gaps in lifecycle).
3. **Zero pollution incidents** — no new `concurrent-writer-*` / cross-session-residue
   incident in `~/.megingjord/incidents.jsonl` attributable to state pollution in the window.
4. **#2647 partition intact** — any residual "Admin baton incomplete" false-positive in the
   window is classified and confirmed to be the `code_touched` tracker-accuracy class (#2647),
   not a state-pollution recurrence. Mixed/unclassified failures block promotion.

## Promotion mechanics

- Consultant posts a `PROMOTION_DECISION` comment on Epic #2091 (or its successor) citing the
  four signals with evidence (replay-eval output, audit coverage %, incident query).
- On promotion: the canonical-main enforcer + per-session keying move from advisory logging to
  hard gates where not already enforced; rollback via the documented opt-out envs.
- Rubric bar for the promotion review: `min(G1..G10) ≥ 7` (consultant peer-review).

## Demotion / rollback

Any single confirmed state-pollution false-positive post-promotion **re-arms advisory mode**
for the affected fix and files a Tier-2 anneal — promotion is reversible, not a ratchet.

## References

- `docs/howto/state-isolation-migration.md` — operator guide (C9 #2110).
- replay-eval #2109 · audit emitter #2108 · Epic #2091 · boundary #2647.
