# ADR-020 — Fleet-level governance observability: watch the watchers + cross-repo epic-aging rollup

- **Status:** Proposed (Phase-0 research for Epic #3520; blocks Phase-1 #3522)
- **Date:** 2026-07-01
- **Deciders:** Manager → Collaborator (author) → Admin → Consultant baton on #3521
- **Refs:** Epic #3520 · research #3521 · dev #3522 · reuse #546 #2405 · reconcile #3354 #750 #753 #1611 #2090 #2895 · origin `copilot-global-skills#1`
- **Consensus gate:** cross-model (cross-family qwen via HAMR cascade-dispatch), threshold ≥ 93

## Context

Two **fleet-level** blind spots kept a scope-complete epic (`copilot-global-skills#1`) invisible for 3.5 months:

- **F4-fleet — "who watches the watchers":** that repo's own `issues-governance.yml` audit had **failed on every run since inception** (fixed in `copilot-global-skills#5`) with **no alert**. The audit meant to surface the stuck epic was itself dead, and nothing watched it.
- **F5 — no cross-repo portfolio lens:** all epic/aging metrics are per-repo, so an orphaned repo's stuck epic never appears in any account-wide view.

GitHub provides **no built-in scheduled-workflow failure alerting** and **no cross-repo portfolio analytics** (re-verified Jul 2026), so both must be built. Recurring pattern (#3064/#3063 silent scheduled-workflow deaths) → `anneal:tier-2`.

## Decision

Ship **two scheduled, API-polling governance jobs** in `megingjord-harness`, reusing the existing scheduled-monitor-that-alerts pattern (#546) and the snapshot-job pattern (#2405). Both are **external observers** — they read state via the GitHub API rather than instrumenting each target workflow — so no per-workflow retrofit is required and an already-dead workflow is still detected.

### D1 — Watcher-health monitor (`watcher-health.yml` + `scripts/global/watcher-health.js`)

**Enumeration.** `gh repo list chf3198 --limit 200 --json name,isArchived` → skip archived → per repo `GET /repos/{o}/{r}/actions/workflows`. Each workflow object carries `state ∈ {active, disabled_manually, disabled_inactivity}` and `path`. Keep only workflows whose YAML has an `on.schedule` trigger (fetch the file once, cache by content SHA — the #3483 fingerprint-cache pattern) — that is the governance/validator watcher set.

**Four distinct failure signatures** (they are genuinely different states, not one threshold):

| Signature | Detection | Why it matters |
|---|---|---|
| `failed-since-inception` | last **K=min(10, total)** runs are **all** `conclusion=failure` (or every run ever, if < K) | the `copilot-global-skills#1` case — never worked, never alerted |
| `N-consecutive-failure` | latest **N=3** runs all `failure`, but an earlier `success` exists | regression in a previously-healthy watcher |
| `auto-disabled-inactivity` | `workflow.state == "disabled_inactivity"` | repo idle 60d → GitHub silently disabled it (workflow runs do **not** count as repo activity — verified) |
| `stale-heartbeat` (dead-man) | no run with `created_at` inside `schedule_interval + 6h` jitter buffer | run **dropped**, not failed — GitHub drops queued cron jobs under load, esp. at :00 |

Runs read via `GET /repos/{o}/{r}/actions/workflows/{id}/runs?per_page=10&event=schedule` (last 10 is sufficient for N and K; `event=schedule` filters out manual/dispatch noise).

**Dead-man's-switch details (web-sourced best practice, Jul 2026):** the heartbeat window is `interval + jitter buffer`, never exactly the interval (a 24h job must be checked at ~30h, not 24h, to absorb GitHub's cron jitter and top-of-hour drops). The monitor itself schedules **off-peak** (`cron: '17 */6 * * *'`, not `0 * * * *`) and carries `workflow_dispatch` so it is manually testable and self-exempt from the very inactivity-disable it detects.

### D2 — Cross-repo epic-aging rollup (`epic-aging-rollup.yml` + `scripts/global/epic-aging-rollup.js`)

Reuse the #2405 6-hourly snapshot-job shape. For each non-archived `chf3198` repo, one GraphQL call fetches open epics **and their child-completion natively** — no manual math:

```graphql
query($q:String!){ search(query:$q, type:ISSUE, first:100){ nodes{ ... on Issue {
  number title url createdAt updatedAt repository{ name }
  labels(first:20){ nodes{ name } }
  subIssuesSummary { total completed percentCompleted }   # native — GA 2026
}}}}
```
Query string per repo: `repo:chf3198/<r> is:issue is:open label:type:epic`. **The `subIssuesSummary` field requires the `GraphQL-Features: sub_issues` header** — omitting it silently returns null (the #3354 trap). Per epic compute: `age_days = now - createdAt`, `idle_days = now - updatedAt`, `child_completion = percentCompleted`.

**Surfaced signal — "silently-parked epic":** `child_completion == 100 && state == open` (the `copilot-global-skills#1` signature: all children done, epic still open) **or** `idle_days > 30`. These are the rows the rollup exists to make un-ignorable.

### D3 — Alert routing (G8 sinks) — reconciled with #546

Single sink function, tiered by severity, aligned with #546's regression-alert precedent:

1. **`incidents.jsonl`** (append-only, machine-readable) — every finding, always. Primary G8 sink.
2. **Dashboard card** on the #1611 surface (no build step, G10) — reads `incidents.jsonl`; renders watcher-health + epic-aging tables.
3. **`governance:needs-triage` GitHub issue** — opened/updated **only** for `failed-since-inception` and `auto-disabled-inactivity` (highest severity; a broken audit is a governance emergency). De-duplicated by a stable `<!-- watcher-health:{repo}/{workflow} -->` marker so re-runs update one issue, never spam.

### D4 — Cost, rate-limit & portability (G3/G5)

- **$0** — pure GitHub API + free fleet; no paid monitoring SaaS (Cronitor/Healthchecks rejected on G3).
- **Rate-limit:** ~1 GraphQL search + 1 workflows-list + ≤1 runs-call per active scheduled workflow per repo. For ~25 repos this is well under the 5000 REST / 5000-point GraphQL hourly budget; batch reads, cache workflow-file fetches by content SHA (#3483), and back off on secondary-limit (`Retry-After`). 6-hourly cadence keeps steady-state cost trivial. **Circuit-breaker (R2 consensus):** reuse the shared circuit-breaker (#2930) — after 3 consecutive `429`/secondary-limit responses, trip open, write a `rate-limited` incident, and abort the remaining cycle rather than hammering the API (the cycle self-heals next run; a tripped breaker is itself an `incidents.jsonl` record, so it never fails silently).
- **`subIssuesSummary` fallback (R2 consensus):** if the GraphQL field is null/absent (feature withdrawn or header dropped), degrade to REST `GET /repos/{o}/{r}/issues/{n}/sub_issues` and compute `completed/total` locally; if that too is unavailable, emit the epic with `child_completion: null` + a `subissue-read-unavailable` note rather than a wrong 0%.
- **Portability / graceful degrade (G5):** if `gh` < 2.94 lacks JSON sub-issue fields, fall back to the raw GraphQL query above; if a repo denies Actions read, log `partial:` and continue (never fail-open silently — #2090/#2895).
- **Error handling:** no `.catch(()=>{})`, no `|| true` (#2090/#2895); any enumeration gap is written to `incidents.jsonl` as `partial-coverage`, so incomplete coverage is itself observable.

### D5 — False-positive / false-negative control + self-test (added R1 consensus)

An alerting monitor is only trusted if its own error rate is bounded, and the #3522 AC already requires a self-test (#1893). Concrete controls:

- **False-positive suppression:** (a) a checked-in `watcher-health.allow.json` allow-list of workflows that are *expected* to be skipped/failing (e.g. deprecated, manual-only) — an entry requires a reason string, so silence is auditable; (b) the `stale-heartbeat` grace buffer (`interval + 6h`) absorbs GitHub cron jitter so a merely-late run is not miscalled dead; (c) the `<!-- watcher-health:{repo}/{workflow} -->` dedup marker means a persistent condition updates one issue rather than re-alerting each cycle.
- **False-negative control:** the monitor writes a `coverage` record every run (`{repos_scanned, workflows_scanned, skipped:[{repo,reason}]}`) to `incidents.jsonl`; a repo that fails enumeration is logged `partial-coverage` (never silently dropped — #2090/#2895). D2 mirrors this with a `repos_without_epic_read` list.
- **Self-test (#1893):** each monitor ships a fixture-driven self-test that feeds synthetic API responses for all four D1 signatures (+ a healthy control) **and the edge cases (R2 consensus): a repo with zero workflows, an archived repo, and a null `subIssuesSummary`** — asserting exactly the expected findings. This is a required Phase-1 AC and the regression guard against the monitor itself silently breaking (the original `copilot-global-skills#1` failure mode).
- **Allow-list hygiene (R2 consensus):** each run validates `watcher-health.allow.json` against the live workflow set and logs any **orphaned entry** (a listed workflow that no longer exists) as `stale-allowlist` — so a suppression rule can never outlive its target and silently mask a real failure.
- **Effectiveness review:** the `coverage` + finding counts in `incidents.jsonl` are the success metrics (findings raised, mean-time-to-surface, coverage %); reviewed at each `anneal:tier-2` cycle.

## Prior-art reconciliation (reuse / do-not-duplicate)

| Ref | Relationship |
|---|---|
| **#546** CLOSED | scheduled branch-protection monitor that alerts — **reuse** the schedule+alert skeleton for D1 |
| **#2405** CLOSED | `cross-team-rd-snapshot.yml` 6h snapshot — **reuse** shape for D2 |
| **#1611** OPEN | cross-team dashboard — **surface** D1/D2 cards here (extends single-repo → fleet) |
| **#3354** OPEN P1 | one "watcher lies" instance — D1 is its fleet-level generalization; **link, don't absorb** |
| **#750/#753** CLOSED | per-workflow silent-failure diagnostics; #750 logged the exact cross-repo gap D2 closes |
| **#2090/#2895** CLOSED | no silent-swallow lint — D1/D2 error handling **conforms** |
| **#3483** | content-SHA fingerprint cache — **reuse** for workflow-file caching |

## Consequences

- **Positive:** the `copilot-global-skills#1` scenario now fires two independent alarms (dead audit → D1 `failed-since-inception`; parked epic → D2 `child_completion==100 & open`). Zero new cost, zero per-workflow retrofit, portable.
- **Negative / risks:** API polling has up-to-one-cycle latency (acceptable — DoD says "within one cycle"); cross-repo enumeration grows O(repos) — mitigated by caching + off-peak cadence; `subIssuesSummary` depends on the sub_issues GraphQL feature staying available (GA as of 2026, low risk).
- **Follow-up:** Phase-1 splits into D1 and D2 as separate AC-bearing children of #3520 (see #3522 refinement).

## Open questions — answered

1. **Enumerate + rate-limit?** → `gh repo list` + per-repo `actions/workflows` (state field) + `?per_page=10&event=schedule`; batch GraphQL, SHA-cache files, off-peak 6h cadence. Well under limits for ~25 repos.
2. **Failure signature?** → four distinct signals (D1 table): `failed-since-inception`, `N=3-consecutive`, `auto-disabled-inactivity`, `stale-heartbeat`. They are not interchangeable.
3. **Alert routing?** → `incidents.jsonl` (always) → #1611 dashboard card → `governance:needs-triage` issue (high-severity only, marker-deduped). Reconciled with #546.
4. **Cross-repo epic-aging?** → native `subIssuesSummary` (with `GraphQL-Features: sub_issues` header — the #3354 trap), `age/idle` from `createdAt/updatedAt`; reuse #2405 snapshot + #1611 surface.

_Sources: [Monitoring scheduled workflows (DEV)](https://dev.to/krissv/monitoring-github-actions-scheduled-workflows-a-practical-guide-31h7) · [Disabling/enabling a workflow (GitHub Docs)](https://docs.github.com/actions/managing-workflow-runs/disabling-and-enabling-a-workflow) · [Sub-issue progress fields (GitHub Docs)](https://docs.github.com/en/issues/planning-and-tracking-with-projects/understanding-fields/about-parent-issue-and-sub-issue-progress-fields) · [REST API for sub-issues (GitHub Docs)](https://docs.github.com/en/rest/issues/sub-issues)_
