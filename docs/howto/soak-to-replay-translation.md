# Soak → replay-based eval translation rubric

Epic #1771 (closed) replaced the calendar-bound "soak" pattern with replay-based eval gates that produce promotion decisions in hours, not weeks. This rubric is the operator-facing reference when writing baton handoffs, PR bodies, Epic scopes, or closeout rubrics.

**Lint backstop**: `scripts/global/megalint/soak-language-guard.js` (#1809) catches calendar phrasing at PR time and points operators back here.

## Translation table

The "Don't write" column carries inline overrides (the rubric is the canonical place where these phrases appear for comparison).

| ❌ Don't write | ✅ Write instead |
|---|---|
| "14-day soak before promotion" <!-- soak-language-override: rubric-example --> | "replay against last N closed PRs + adversarial fixtures via `soak-replay-runner.js`; promote when compliance ≥85%" |
| "30-day measurement window" <!-- soak-language-override: rubric-example --> | "historical telemetry replayed in a single run; promotion decision rendered in hours" |
| "needs multi-day soak" <!-- soak-language-override: rubric-example --> | "needs replay evidence from `soak-replay-runner.js` against closed-PR baton trail" |
| "promote to required after a 14-day soak" <!-- soak-language-override: rubric-example --> | "promote to required when replay-runner shows ≥X% compliance across the historical sample" |
| "7-day window of observation" <!-- soak-language-override: rubric-example --> | "replay across last 7 days of closed-PR/cost-telemetry data — completes in minutes" |
| "calendar soak phase" <!-- soak-language-override: rubric-example --> | "replay-eval phase per #1771" |
| "wait N days to validate" <!-- soak-language-override: rubric-example --> | "validate via `soak-replay-runner.js` against logs/cost-telemetry.jsonl (or comparable historical surface) in one run" |

## Decision tree: do you actually need calendar exposure?

```
Validation question
        ↓
Is the gate measuring HISTORICAL behavior?
   yes  → replay against historical data; no calendar wait
   no   ↓
Is the gate measuring a fixed-rule decision (e.g., compliance %)?
   yes  → replay against adversarial-fixture-gen.js fixtures; no calendar wait
   no   ↓
Is this a high-novelty operator environment where historical replay
cannot represent the new operator's traffic distribution?
   yes  → calendar exposure may be needed — see "Exception" below
   no   → replay still works; default to it
```

## Exception: high-novelty operator environment

Per `Epic #1771 §"Out of scope"`, calendar exposure remains available **only** for cases where replay is genuinely inconclusive (high-novelty operator environments). When this exception applies, both must be true:

1. The artifact explicitly states the high-novelty rationale.
2. The artifact includes the override comment `<!-- soak-language-override: <rationale> -->` on the same line as the calendar reference, OR the issue carries label `soak-language-override:approved`.

Without either, the soak-language-guard lint will fail at PR time.

## Canonical infrastructure to cite

- `scripts/global/soak-replay-runner.js` — replays closed-PR baton trails against a v2 helper; outputs compliance metrics.
- `scripts/global/adversarial-fixture-gen.js` — generates synthetic edge-case inputs deterministically.
- Epic #1771 closeout — full architecture: 5-layer eval stack (golden dataset → historical replay → synthetic adversarial → shadow mode → canary).

## When the lint flags you

The lint message includes a pointer back to this file. Three options:

1. **Translate** the phrase using the table above (preferred).
2. **Drop** the calendar reference entirely if it was unnecessary scaffolding.
3. **Override** with the HTML comment when the exception genuinely applies.

## Worked examples (from real recurrences)

| Original (from this repo's history) | Translated |
|---|---|
| "promote to required after a 14-day soak per Path D rollout" <!-- soak-language-override: rubric-example --> | "promote to required when `soak-replay-runner.js` shows ≥95% coverage across the historical cost-telemetry sample" |
| "#1793 (cache-hit SLO — needs multi-day soak)" <!-- soak-language-override: rubric-example --> | "#1793 (cache-hit SLO — replay against historical cache-stats.jsonl per #1771)" |
| "#1794 (premium 12% governor — needs 30-day window)" <!-- soak-language-override: rubric-example --> | "#1794 (premium 12% governor — replay against last 30 days of cost-telemetry.jsonl in one run; no calendar wait)" |

## Related

- Epic #1771 (closed) — replay-based eval gate Epic.
- `[[feedback-soak-language-default]]` — operator-side anti-pattern memory.
- #1809 — this rubric's parent ticket (the self-anneal that fixed the operator drift).
