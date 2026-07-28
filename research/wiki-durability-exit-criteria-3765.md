---
title: "Epic #3719 exit-criteria proof — the wiki upkeep holds (not asserted once)"
ticket: 3765
epic: 3719
type: wisdom-project
content_trust_score: 1.0
created: "2026-07-13"
updated: "2026-07-13"
status: measured
---

# Epic #3719 exit-criteria proof (#3765 capstone)

Every prior wiki generation (`#22 → #866 → #1625 → #1942 → #3063`) shipped `resolution:completed` **once**,
then silently rotted. This Epic's acceptance bar is the recurrence itself: prove the upkeep metrics **hold**,
sustained, not asserted once. This document records the mechanism + the measured current state.

## The sustained-proof loop (`scripts/wiki/sustained-proof.js` + `wiki-sustained-proof.yml`)

Each cycle measures the **fresh wiki-mirror** work-log health (the reconcile lands there, #3729; consumers read
it, #3779) via the reused `wiki-health-detector` (`coverage_ratio` vs `COVERAGE_FLOOR = 0.95`, `stale_ratio`
vs `STALE_CEILING = 0.10`), appends a record to the committed **non-gitignored** proof-log
`governance/wiki-sustained-proof.jsonl` (persisted on `wiki-mirror` — it cannot self-silence the way the
`#3718` gitignored alarm did), and `checkSustained` asserts the **last N = 5 cycles** all clear the bar. A
**failing** cycle (a real upkeep regression) hard-fails + files a deduped durable issue. `N = 5` is a
**replay-eval count** that accrues over reconcile cycles — deliberately **not** a wall-clock window (anti-
calendar guardrail #2983 / #1771). It is the dev→test iterative-proof loop the Epic requires.

## Measured current cycle (the bar is met NOW on the fresh surface)

| metric | value | bar | pass |
|---|---|---|---|
| coverage_ratio | **1.00** | ≥ 0.95 | ✅ |
| stale_ratio | **0.00** | ≤ 0.10 | ✅ |
| entry_count | 2137 | — | — |
| surface | `wiki-mirror` | fresh | ✅ |

Seed cycle recorded in `governance/wiki-sustained-proof.jsonl`. The remaining `N-1` cycles accrue as the daily
reconcile + this proof loop run; `checkSustained.sustained` flips true once the trailing 5 all hold.

## Epic exit-criteria scorecard

| # | Criterion | Status |
|---|---|---|
| §9.1 | Upkeep (coverage ≥ 0.95, staleness ≤ 0.10) | ✅ **met now** (1.00 / 0.00); sustained accrues |
| §9.2 | Liveness (≥1 reconcile / 24h, required signal) | ✅ #3759 (hard-fail monitor) |
| §9.3 | Retrieval (baseline + wired) | 🟡 baseline #3760, fresh read-path #3779; wired-into-baton + token-cost = #3761, embeddings = #3762 |
| §9.4 | Schema (validator == shipped, required gate) | ✅ #3763 |
| §9.5 | Human surface | ❌ #3764 |
| §9.6 | Proof holds (N=5, not one-shot) | 🟡 mechanism shipped; current cycle passes; N=5 accrues |

## Gate promotion (advisory → required) — replay-eval-gated, NOT calendar (#1617 disposition)

`checkSustained.sustained` is the **promotion-eligibility** signal for flipping the drift-gate + lint-gate from
advisory to required. Per the anti-calendar rule, the required-flip is **deferred until the trailing N = 5
cycles hold** (ship advisory; promotion deferred) — it is eligibility-gated, never asserted on a calendar.
