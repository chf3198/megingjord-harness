# closeout-schema API Transient Handling

Issue: #2140

## What Changed
The `closeout-lint` workflow now retries transient GitHub API failures (403/422/429/5xx and `Resource not accessible by integration`) with bounded retries before deciding outcome.

If retries are exhausted for that transient class, the workflow posts/updates an advisory marker on the linked issue:
- `<!-- closeout-schema-api-transient -->`
- heading: `closeout-schema: api-transient`

The run exits advisory for that transient class instead of failing hard.

## Operator Guidance
1. Open the linked issue and look for the `closeout-schema: api-transient` advisory comment.
2. Re-run failed checks once GitHub API access stabilizes:
   - `gh run rerun --failed <run-id>`
3. If advisory repeats across reruns, treat as platform incident and log recurrence evidence.

## Non-Transient Errors
Non-transient API and schema violations remain blocking failures.
