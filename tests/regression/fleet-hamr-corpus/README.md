# Fleet+HAMR Regression Corpus

Refs Epic #2150 #2203. Captures historic fleet/HAMR regressions that the harness must never re-introduce. Each entry is a replay-eval scenario the harness `scripts/regression/fleet-hamr-replay.js` runs nightly + per-PR on relevant paths.

## Entries

| Entry | Source | Pattern guarded against |
|---|---|---|
| `01-sticky-route-mis-recording.json` | P1-7 #2178 (Epic #2041 P1-1 #2175 Phase-0 dog-food) | wrapProviderCall('ollama', cb, {tier:'fleet'}) mis-records provider as paid sticky-pick (e.g. groq) in cache-stats.jsonl |
| `02-timeout-budget-undersized.json` | Phase-0 #2174 dog-food → Epic #2150 P1-1 #2201 | qwen2.5-coder:32b fleet dispatch hits 907s p99 against 600s hardcoded bound |
| `03-consultant-epic-closeout-not-recognized.json` | #1993 fix in lint-epic-drift.js | lintEpicDrift Class C check missed Epic-level CONSULTANT_EPIC_CLOSEOUT artifact |
| `04-bypass-detection-not-recognized.json` | P1-2 #2220 (Epic #2029 / #2246 #2233) | hamr-bypass-detector.detectBypass fails to flag a direct curl to a known paid-provider endpoint |
| `05-fleet-direct-block-not-enforced.json` | P1-3 (Epic #2029 / #2246 #2233) | hamr-fleet-direct-block.shouldBlock fails to block a fleet-bypass when MEGINGJORD_FLEET_DIRECT_BLOCK=1 |

Each `*.json` file is a self-contained scenario: input fixture + expected behavior + assertion script.

A `predicate_check` may use the generic form `{ "fn", "args", "result_path"?, "expected_result" }` to
exercise any module export; the legacy `childProgressComplete` form (entry 03) remains supported.
