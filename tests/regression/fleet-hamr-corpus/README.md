# Fleet+HAMR Regression Corpus

Refs Epic #2150 #2203. Captures historic fleet/HAMR regressions that the harness must never re-introduce. Each entry is a replay-eval scenario the harness `scripts/regression/fleet-hamr-replay.js` runs nightly + per-PR on relevant paths.

## Entries

| Entry | Source | Pattern guarded against |
|---|---|---|
| `01-sticky-route-mis-recording.json` | P1-7 #2178 (Epic #2041 P1-1 #2175 Phase-0 dog-food) | wrapProviderCall('ollama', cb, {tier:'fleet'}) mis-records provider as paid sticky-pick (e.g. groq) in cache-stats.jsonl |
| `02-timeout-budget-undersized.json` | Phase-0 #2174 dog-food → Epic #2150 P1-1 #2201 | qwen2.5-coder:32b fleet dispatch hits 907s p99 against 600s hardcoded bound |
| `03-consultant-epic-closeout-not-recognized.json` | #1993 fix in lint-epic-drift.js | lintEpicDrift Class C check missed Epic-level CONSULTANT_EPIC_CLOSEOUT artifact |

Each `*.json` file is a self-contained scenario: input fixture + expected behavior + assertion script.
