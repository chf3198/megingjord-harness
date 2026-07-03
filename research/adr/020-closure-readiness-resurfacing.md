# ADR-020: Closure-Readiness Resurfacing + Superseded-Resolution Taxonomy

**Status**: Proposed
**Date**: 2026-07-01
**Phase**: 0 (research-first) for Epic #3517 · **Blocks** #3519
**Consensus**: cross-family red-team via `research-redteam-loop` (gate 93, reviewer = fleet qwen, non-Anthropic)

## Context

`copilot-global-skills#1` — a `priority:critical` `type:epic` — was **100% delivered in
March 2026** yet stayed OPEN for **3.5 months**. Three residual gaps let scope-complete,
exempt, or overtaken-by-events work sit open by default:

- **F1 — no positive close-eligibility signal.** Only a close-*time* veto exists
  (#3350 `epic-close-readiness.yml`). Nothing tells an owner "all children are terminal —
  you may close this now." #437 was advisory-only and status-oriented.
- **F3 — stale-exemption blind zone.** `stale.yml` exempts `type:epic` + milestoned issues
  (`exempt-issue-labels: type:epic`, `exempt-all-issue-milestones: true`). Exemption
  conflates *don't auto-close* with *never review*, so exempt epics are never resurfaced.
- **F6 — no overtaken-by-events closure reason.** The taxonomy has
  `completed|released|duplicate|research-delivered` only. Work whose capability shipped
  elsewhere has no honest closure reason, so it stays open.

Recurring drift (this is `anneal:tier-2`): #1 · #1899→#3398 · #2119's 38 orphans.

### State of the art (web research, Jul 2026)

- GitHub now ships a **native scheduled "Sub-Issue Closer"** (`github/gh-aw`) that runs
  daily and **auto-closes** a parent when all sub-issues are closed, with LLM safe-outputs
  ("be conservative; when in doubt, don't close"; max 20/run). We deliberately **reject
  auto-close** for epics: closure is a retained human/Manager judgment carve-out and the
  #3350 veto exists precisely because auto-close is unsafe for epics. We adopt its
  *detection* pattern, not its *action*. [gh-aw sub-issue-closer](https://github.com/github/gh-aw/blob/main/.github/workflows/sub-issue-closer.md), [auto-close project workflow](https://github.blog/changelog/2024-04-25-github-issues-projects-auto-close-issue-project-workflow/)
- **Backlog hygiene 2026:** mandatory review at ~90d idle (60d in mature orgs), age buckets
  (<30 / 30-90 / 90-180 / >180d), balanced against **delivery velocity** — "exempt ≠ ignore;
  archive/close stale monthly." Supports velocity-relative thresholds over fixed calendar
  days. [backlog health](https://count.co/metric/backlog-health-analysis), [backlog management](https://www.nimblework.com/blog/team-backlog-management-tips/)
- **Resolution taxonomies** (Jira/Bugzilla) carry distinct terminal reasons —
  `WONTFIX`/`OBSOLETE`/`DUPLICATE`/`WORKSFORME` — validating a `superseded` reason
  separate from `duplicate`. [Jira resolutions](https://support.atlassian.com/jira-cloud-administration/docs/what-are-issue-statuses-priorities-and-resolutions/), [Bugzilla RESOLVED](https://wiki.documentfoundation.org/QA/Bugzilla/Fields/Status/RESOLVED)

## Decision

**Invariant (I0): surface-only, never auto-close.** All three mechanisms below resurface work
to an owner and **never** close an epic; closing stays a Manager/human act (retained carve-out;
#3350 veto intact). Any detector uncertainty **fails closed** (no false signal), never open.

### D1 — Positive close-eligibility signal (F1)

- New label **`status:close-eligible`** (Epic active goal; all children terminal; owner review pending).
- New weekly workflow **`epic-close-eligible.yml`**: for each OPEN `type:epic`, read children
  via GraphQL sub-issues **with `GraphQL-Features: sub_issues` header** (the #3354 fails-open
  trap — without it the query silently reports zero children). When **every** child is terminal
  (CLOSED, or `status:done|cancelled`), apply `status:close-eligible` and post **one**
  owner-addressed comment `CLOSE_ELIGIBLE: epic #N — K/K children terminal → Manager review`.
- **Fail-closed detection (mitigates the #3354 fails-open trap):** if the GraphQL sub_issues
  query errors, returns `null`, or the `GraphQL-Features: sub_issues` header is dropped, the
  detector treats child-count as **unknown** and does **nothing** (never signals eligible) — it
  emits `SUBISSUE_DETECT_DEGRADED` to `incidents.jsonl` instead. A secondary **REST timeline**
  cross-check confirms the closed-count; the two must agree. **If the REST cross-check itself
  errors or the two sources disagree → also fails closed** (child-count = unknown, no signal,
  incident logged) — there is no path where a degraded read produces a positive eligibility.
- **Circuit-breaker (anti-flap):** `status:close-eligible` is applied only after **two
  consecutive weekly sweeps** agree — one noisy read cannot toggle the label.
- **Debounce:** the label *is* the state — skip if already present; **auto-remove** the label
  (and post `CLOSE_ELIGIBLE_CLEARED`) if any child reopens. One comment per eligibility
  transition → no recurring noise.
- **Reconciliation:** complements #3350 (close-time veto, unchanged); replaces #437's advisory
  with a labelled, owner-pinged signal; the label feeds the #3520 aging-rollup dashboard and
  routes through the **existing propose-only review queue (#2990)** — no new queue built; a
  Manager verdict is required before any close (never mutates blindly).

### D2 — Exempt-item review cadence, velocity-relative (F3)

- New label **`status:exempt-review`** (exempt-but-idle; surfaced for owner review, not closure).
- New scheduled workflow **`exempt-review-sweep.yml`**: threshold is **velocity-relative**
  (honors #2983's anti-calendar critique, Epic #1771): `idle_threshold = max(FLOOR_45D,
  k × median_cycle_time)` where `median_cycle_time` = repo rolling median of child
  `in-progress→done` over the trailing N closed tickets, `k=3`, `FLOOR_45D` aligns the floor
  with `stale.yml`'s 45d but as a **review** trigger, not a close. An exempt epic with no
  child state-change and no comment for > `idle_threshold` gets `status:exempt-review` + a
  queue entry (into the #2990 propose-only queue). **Surface only — never closes.** Preserves
  the stale.yml exemption (still no auto-close) while filling the "never reviewed" gap.
- **Velocity-median helper (`median-cycle-time.js`):** trailing `N=20` closed children of the
  repo; per child compute `closedAt − (first status:in-progress event)`; take the median. If
  `< 5` valid samples → fall back to `FLOOR_45D` (cold-start guard). **Degenerate-median guard:**
  a computed median `< 1d` (e.g. all children closed the same day ⇒ median 0) is treated as
  cold-start → `FLOOR_45D`, so a burst-closed epic never trips early. Pure function, ships with
  fixture tests.
- **Worked example:** repo median child cycle = 6d, `k=3` → 18d < `FLOOR_45D` ⇒ threshold = **45d**.
  Faster repo median = 20d, `k=3` → 60d > floor ⇒ threshold = **60d** (matches the "mature-org 60d"
  web benchmark). Slow single-child epics never trip early because the floor dominates.
- **Staged rollout (validates the cold-start guard before it can misfire):** ship in
  **shadow/report-only** mode for one full cycle — the sweep logs would-be `status:exempt-review`
  targets to `incidents.jsonl` but applies no label; enable enforcement only after the shadow log
  is reviewed. Synthetic fixtures (N=0, N<5, N=20, all-same-day) test the median + floor paths.
- **Boundary vs #2920 (CLOSED — `epic-dormant-review.yml`):** #2920 already reminds
  `status:dormant` epics at a fixed 90d. D2 targets the *different* population — epics in the
  `stale.yml` **exemption blind zone** that carry **no** `status:dormant` label and therefore
  get no review at all. D2 **reuses** #2920's cron scaffold and `EPIC_*_AFTER_DAYS` config,
  makes the threshold genuinely velocity-relative, and **defers to #2920** for already-dormant
  epics. **Edge cases:** (a) `status:dormant` present → skip (no double-notify); (b) an epic that
  gains `status:dormant` *after* entering `exempt-review` → the exempt-review label auto-clears
  and #2920 takes over; (c) `status:close-eligible` present → skip (D1 already surfaced it).

### D3 — `resolution:superseded` taxonomy (F6)

- New label **`resolution:superseded`** — *overtaken by events*: scope made moot because the
  capability shipped elsewhere or the world changed. Disambiguation:

  | Reason | Meaning | Distinct because |
  |---|---|---|
  | `completed` | done as specified | work was performed |
  | `released` | shipped to main/prod | deployment milestone |
  | `duplicate` | same scope already tracked | **identity** with another ticket |
  | `research-delivered` | research finding delivered | research-lane terminal |
  | **`superseded`** | scope no longer needed; overtaken | **not identical** (vs duplicate), **not performed** (vs completed) |

- **Wiring:** the #3398/#3420 semantic-supersession detector, on a confirmed verdict
  (cited evidence + cross-model), applies `resolution:superseded` and closes with a required
  **`SUPERSEDED_BY: #M`** body line. **False-positive controls (defense-in-depth):**
  (1) **two-signal rule** — a confirmed verdict requires the #3398 cross-model semantic match
  **and** a resolvable `SUPERSEDED_BY` reference (open/closed ticket or merged PR) that actually
  exists; (2) **evidence guard** — missing/unresolvable reference → route to `status:exempt-review`,
  never close; (3) **self-supersession block** — `#M` may not be the item itself or a descendant;
  (4) **reversibility** — a superseded-close reopens automatically if `#M` is later reopened
  (covered by an explicit regression self-test in T-F6);
  (5) **appeals path** — a contested verdict gets `status:contested-superseded` and routes to the
  #2990 propose-only queue for a Manager verdict rather than auto-closing;
  (6) **acyclic guard** — the `SUPERSEDED_BY` chain must be a DAG: mutual/circular supersession
  (A→B and B→A, or any cycle) is rejected and routed to `status:contested-superseded` (a cycle
  means neither is truly overtaken — a human adjudicates). Test fixture covers the 2-cycle.
  Owns only the *reason/closure* step; detection stays in the #3398 lane (no rebuild).

### D4 — Consensus protocol (research-first gate)

This ADR was produced under `research-redteam-loop` (`--gate 93 --web`): mandatory
corpus-overlap scan (open+closed, #2801) → G3 zero-cost dispatch (fleet `cascade-dispatch.js`
first; on the fleet's latency/availability failure, failover to the **$0 free-cloud chain**
groq/mistral/cerebras/gemini) → rework until score > 93. **Cross-family invariant (falsifiable):**
the reviewer's model family MUST be non-Anthropic — allowed families {qwen, llama, gemini,
mistral}; a review authored by any `claude-*` / Anthropic model is an invariant violation and is
discarded. Reviewer artifacts are the per-iteration `RESEARCH_REDTEAM_ITER` comments on #3518
(model + provider + score recorded each round).

## Consequences

- **Pro:** a scope-complete epic is surfaced within one sweep cycle; exempt-but-idle epics
  get a review path without losing auto-close exemption; overtaken work gets an honest,
  non-lying closure reason; all three are **surface-only** so no epic is ever auto-closed.
- **Pro (G3):** three small scheduled workflows + label applies; zero paid API. Reuses the
  #3398 detector and #3520 dashboard.
- **Con / risk:** two new `status:*` labels risk board clutter → mitigated by auto-clear on
  reopen and single-comment debounce. Velocity-median needs a small helper (D2) → shipped
  with tests. Native gh sub-issue-closer could tempt auto-close later → ADR records the
  deliberate rejection.
- **Regression guard:** no change to `epic-close-readiness.yml` (#3350); the close-time veto
  and the open-time signal are orthogonal.
- **Observability & rollback (G8/G6):** each workflow emits a schema-v3 event to
  `dashboard/events.jsonl` (`signals_applied`, `false-positive-appeals`, `shadow-would-apply`),
  so effectiveness (eligible-surfaced-per-cycle, appeal rate, flap rate) is measurable; each
  mechanism carries a kill-switch env flag (`CLOSE_ELIGIBLE_DISABLED` / `EXEMPT_SWEEP_DISABLED` /
  `SUPERSEDED_APPLY_DISABLED`) for instant no-op rollback without a revert.

## Phase-1 decomposition (AC-bearing children of #3517)

The bundled #3519 is **split** (no-bundling governance) into three ≤100-line, test-bearing tasks:

- **T-F6** (`resolution:superseded` + `status:contested-superseded` labels + closure-reason doc +
  wire to #3398 apply-step + the six false-positive controls). Test fixtures MUST cover: evidence
  guard (missing ref), self-supersession, the **appeals path** (contested → #2990 queue), the
  **acyclic guard** (2-cycle rejection), and **reversibility** (auto-reopen on `#M` reopen).
  *Unblocks the others by landing the taxonomy first.*
- **T-F1** (`epic-close-eligible.yml` + `status:close-eligible` + sub_issues-header detector +
  validator/tests + self-test #1893). **Must include a regression test proving the close-eligible
  signal cannot bypass or weaken the #3350 close-time veto** (the signal only surfaces; the veto
  still governs the actual close).
- **T-F3** (`exempt-review-sweep.yml` + `status:exempt-review` + velocity-median helper + tests).

Each: files ≤100 lines (G10), validator ships with tests + self-test (#1893), lint clean,
no regression to #3350.

## Prior art reconciled (build-on, do not duplicate)

#3350 (veto — complemented) · #3354 (sub_issues-header dependency — honored) ·
#437 (advisory — superseded by D1) · #2632 (state semantics — reuse names) ·
#3398/#3420 (detection — wired, not rebuilt) · #2983 (calendar critique — velocity-relative) ·
#1771 (velocity thresholds) · **#2920** (dormant-review cron — reused, deferred-to) ·
**#2990** (propose-only review queue — reused as the surface) · Epic origin `copilot-global-skills#1`.

## Corpus-overlap boundary decision (#2801 — pre-ACCEPT)

related_tickets: #3519 #3518 #3517 #3522 #3521 #2920 #2990 #3099 #3422 #3264 #3420 #2632
overlap_decision:
- **#3517 / #3518 / #3519** — *containment, not redundancy.* This ADR **is** #3518's
  deliverable; #3517 is its parent Epic; #3519 is the downstream implementation this ADR splits.
- **#3520 / #3521 / #3522** (aging-rollup / watcher-health) — *complementary (produce vs consume).*
  This Epic **produces** the `status:close-eligible` signal; the #3520 lane **consumes** it for
  cross-repo rollup. No overlap in ownership.
- **#2920** (dormant-review cron, CLOSED) — *overlap resolved by reuse + population split.* D2
  reuses its scaffold, defers to it for `status:dormant` epics, and covers only the exemption
  blind zone. Not duplicated.
- **#2990** (propose-only review queue, CLOSED) — *reuse.* D1/D2/D3 surfaces route into it; no
  new queue is built.
- **#3398 / #3420** (supersession detection) — *gap filled downstream.* This Epic adds only the
  resolution *reason* + apply-step; detection is owned there.
- **#3264 / #3099 / #3422** — *adjacent (epic-progress / board-hygiene), no scope conflict.*

_Refs: #3517 #3518 #3519 #3350 #3354 #437 #2632 #3398 #3420 #2983 #1771 #2920 #2990 #3520_
