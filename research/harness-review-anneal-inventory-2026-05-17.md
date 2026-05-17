---
title: Harness review + self-anneal systems inventory
type: research
created: 2026-05-17
status: active
ticket: 1746
parent_epic: 1745
---

# Harness review + self-anneal systems inventory (#1746)

## Purpose

Closes #1746 (Phase 1 of Epic #1745). Concrete map of existing review-quality, governance, and self-anneal routing systems already shipped in the harness. Surfaces what to **reuse** vs what to **build** when designing the canonical review-score contract (Phase 2, #1748).

## Headline finding

**The G1–G9 v2 rubric infrastructure is already shipped.** It is not being invoked by operators. The gap Epic #1745 needs to close is much smaller than the dormant-Epic body assumed: most of the design is built; what's missing is (a) automatic invocation at closeout time, (b) 1–100 score normalization, and (c) score→self-anneal-tier classifier.

## Surface inventory

### 1. Rubric specification (shipped)

**`inventory/rubric-g1-g9-v2.json`** (62 lines): canonical G1–G9 v2 rubric with 27 evidence boxes (3 per goal × 9 goals). Each box has:

- `id` — stable identifier
- `check` — human-readable description
- `evidence_command` — DSL spec `<contains|regex|not_regex>:<trail|diff|closeout>:<literal-or-regex>`

The DSL evaluates against three text sources: `trail` (issue baton artifacts), `diff` (PR diff), `closeout` (consultant closeout text). All commands are pure-function over those strings; no live API calls.

### 2. Scorer (shipped)

**`scripts/global/rubric-score.js`** (76 lines): deterministic scorer.

```bash
node scripts/global/rubric-score.js \
  --rubric inventory/rubric-g1-g9-v2.json \
  --trail trail.txt --diff diff.txt --closeout closeout.txt
```

Output shape:

```json
{
  "rubric_version": "g1-g9-v2",
  "goals": {
    "G1": { "title": "Governance", "boxes_checked": 3, "boxes_total": 3, "score": 10, "boxes": [...] },
    "G2": { "title": "Quality", "boxes_checked": 2, "boxes_total": 3, "score": 6.67, "boxes": [...] },
    ...
  },
  "mean": 8.4
}
```

Score formula per goal: `(boxes_checked / boxes_total) * 10`. Mean is unweighted average across 9 goals. **Range is 0–10, not 1–100** — the dormant Epic's 1–100 assumption needs reconciliation (see Gap 1 below).

### 3. Validator (shipped)

**`scripts/global/megalint/consultant-closeout.js`** lines 22–29: closeout-schema rubric check accepts EITHER:

- Legacy prose: regex `/G[1-9]\s*[=:]/i` (e.g., `G1: 9/10`)
- Structured v2: requires `rubric_version: "g1-g9-v2"` + `boxes_checked` + `boxes_total` in the closeout text

Both modes pass. Validator does not currently compute a score itself — just checks the marker is present.

### 4. Tests (shipped)

**`tests/rubric-score.spec.js`** (68 lines, Playwright runner): covers schema validation (G1–G9 each with ≥3 boxes), positive-context scoring, pass-context sufficiency for closeout schema check.

### 5. Self-anneal event surface (shipped)

**`~/.megingjord/incidents.jsonl`** event schema v2 (per `scripts/global/anneal-event-schema.js`):

```
{ version, timestamp, tier, trigger_role, trigger_type, pattern_id,
  severity, evidence, ticket_ref, epic_ref, proposal_id, dedupe_key,
  session_id, schema_compat }
```

Required fields: `version, timestamp, tier, trigger_role, trigger_type, severity, session_id`. `tier ∈ {1, 2, 3}` per `instructions/workflow-resilience.instructions.md` three-tier model.

### 6. Three-tier escalation contract (shipped)

**`instructions/workflow-resilience.instructions.md`** §"Three-tier escalation model":

- **Tier 1 — Observation**: any role appends drift event to `incidents.jsonl`. Pure trend capture; no ticket.
- **Tier 2 — Mid-flight pivot (auto-ticket)**: triggers when `severity ≥ medium` AND `(recurrence ≥ 2 in 7d OR trigger_type == "manual-pull")` AND no active session-pivot AND no matching suppression entry.
- **Tier 3 — Consultant goal-failure escalation**: consultant authority only; triggered when rubric finds G1–G9 violation post-implementation. Manager reopens failed AC and files self-anneal Epic.

**This is the connective tissue Epic #1745 needs to wire to.** Tier 3 explicitly references "rubric finds G1–G9 violation" — the linkage already exists in the contract, just not in the closeout flow.

### 7. Goal-failure emission validator (shipped)

**`scripts/global/megalint/goal-failure-emission.js`** — exists and consumed by `tests/rubric-score.spec.js`. Likely the bridge between rubric output and Tier 3 escalation. Worth deeper read in #1748 design phase.

### 8. Harness goals constitution (shipped)

**`instructions/harness-goals.instructions.md`** defines G1–G10 (note: 10 goals, not 9 — but the v2 rubric only covers G1–G9). G10 is "Maintainability" — added later, not in the rubric yet. **Gap to flag**.

### 9. Labels / ticket templates

No labels currently encode rubric scores. No issue templates have score fields. Operators rely on prose in `## Rubric` sections of closeout comments.

## Gaps to address in Phase 2 (#1748 design)

### Gap 1: 0–10 mean vs 1–100 scale

`rubric-score.js` produces 0–10 means. Epic #1745 body proposes 1–100 with bands:

- `<70 = F = P1 self-anneal`
- `<B+ = P2 self-anneal`
- `<A+ = further analysis`

Two reconciliation paths:

- **Path A**: Multiply mean × 10 to land 0–100 range. Bands map naturally (mean 7.0 = 70/100 = F threshold).
- **Path B**: Adopt 1–100 directly by changing rubric-score.js formula and re-baselining tests.

Path A is the smallest correct fix — preserves existing scorer + tests + structured outputs; adds a one-line scaling in the consumer.

### Gap 2: No operator-side invocation contract

The scorer exists, but operators (including me) emit prose `G1: 9/10` instead of invoking it. The system trusts the regex marker. Fix candidates:

- Mandate structured rubric in closeout-schema (deprecate legacy prose).
- Provide `npm run rubric:score -- --issue N --pr M` that auto-builds ctx from the issue/PR and prints the JSON.
- Integrate as a megalint validator that fails when prose form is used but the structured form is absent.

### Gap 3: No score→tier classifier

Even when the structured rubric is emitted, there's no machine that reads `mean: 6.5` and files a Tier-3 self-anneal ticket. The Tier 3 contract in `workflow-resilience.instructions.md` cites this explicitly ("consultant rubric finds G1–G9 violation") — implementation missing.

Phase 3 (#1749) would build `scripts/global/review-score-classifier.js`:

```js
function classify(mean) {
  if (mean < 7.0)  return { band: 'F',  tier: 3, action: 'file-p1-self-anneal' };
  if (mean < 8.0)  return { band: 'D',  tier: 2, action: 'file-p2-self-anneal' };
  if (mean < 9.0)  return { band: 'C',  tier: 1, action: 'log-tier1-event' };
  if (mean < 9.5)  return { band: 'B+', tier: 1, action: 'log-tier1-event' };
  return { band: 'A+', tier: 0, action: 'none' };
}
```

Numeric thresholds are placeholders for #1748 design; #1747 web-search research informs calibration.

### Gap 4: G10 (Maintainability) not in rubric

`harness-goals.instructions.md` lists G10 Maintainability but `rubric-g1-g9-v2.json` only covers G1–G9. Either extend the rubric to v3 (g1-g10) or document G10 as out-of-scope for rubric scoring (#1748 decision).

### Gap 5: Rubric tests use Playwright runner

`tests/rubric-score.spec.js` uses `@playwright/test`. This drags Playwright into the rubric-tests dependency, which is heavy for pure-function validation. Consider migrating to Node's native `node --test` for lighter CI.

## Reuse opportunities (what NOT to build in Phase 3)

- ✅ Reuse `inventory/rubric-g1-g9-v2.json` — keep schema, just extend if G10 in scope.
- ✅ Reuse `scripts/global/rubric-score.js` scoring function and DSL.
- ✅ Reuse `incidents.jsonl` event schema for emitting tier events.
- ✅ Reuse closeout-schema `structuredRubric` regex; just promote from optional to required.
- ✅ Reuse `workflow-resilience.instructions.md` Tier 3 contract; #1750 wires the implementation.

## What Phase 2 design (#1748) must decide

1. 1–100 scale via Path A (×10) or Path B (re-baseline)?
2. Band thresholds (placeholder above; needs #1747 calibration data).
3. Mean weighting: unweighted average vs goal-priority-weighted (G1 > G2 > G3 > ... per harness-goals.instructions.md)?
4. Cross-family-review interaction: does the cross-family reviewer (e.g., Qwen) score the rubric independently, or does the operator score and the cross-family reviewer validates? Epic #1716 rotation contract intersects here.
5. G10 in scope or deferred?

## Recommended Phase 3 (#1749 implementation) deliverables

- `scripts/global/review-score-classifier.js` — `classify(mean) → {band, tier, action, ticket_template?}`
- Patch `scripts/global/megalint/consultant-closeout.js` to invoke `rubric-score.js` and `review-score-classifier.js`; emit advisory when prose-only; promote to required after Path D soak — sorry, after replay-eval validation per Epic #1771.
- Patch `scripts/global/megalint/index.js` to register the new classifier output as a validator surface.
- Extend `tests/rubric-score.spec.js` (or migrate to `node --test` + add a classifier spec) covering classification cases at every band boundary.

## ACs satisfied (this ticket)

- [x] Q1 (where rubric judgments expressed) — answered: `inventory/rubric-g1-g9-v2.json`, `rubric-score.js`, prose-form in CONSULTANT_CLOSEOUT comments.
- [x] Q2 (workflows that create/consume self-anneal signals) — answered: `incidents.jsonl`, `workflow-resilience.instructions.md` three-tier model, `goal-failure-emission.js`.
- [x] Q3 (labels/templates/baton artifacts encoding dimensions) — answered: no labels or templates yet; baton artifacts carry prose only.
- [x] Q4 (what to reuse) — 5 reuse items + 1 cross-link to Epic #1771 replay-eval enumerated above.

## Related references

- Parent Epic: #1745 (review-score governance contract + self-anneal policy).
- Sibling Phase 1 research: #1747 (calibration practices via web search).
- Composes with: Epic #1716 (cross-family rotation contract; affects who scores the rubric).
- Composes with: Epic #1771 (replay-based eval; replaces calendar-bound rubric validation).
- Composes with: #1809 (soak-language guard; same self-anneal shape this ticket maps).
- Composes with: #1811 (meta-anneal documenting the operator-side absence of rubric discipline).
