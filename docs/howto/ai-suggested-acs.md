# AI-suggested acceptance criteria (with reconciler measurability backstop)

_Epic #1299 · implementation #3329 · Phase-0 synthesis #1302 · reconciler #1289/#3319_

`scripts/global/ac-suggest.js` helps a Manager draft Epic acceptance criteria. It proposes 3–7
measurable ACs from a problem statement, then runs each through the **measurability backstop**
(`scripts/global/epic-ac-reconcile.js`) before any AC is offered for approval.

## The one thing to understand first

The backstop verifies an AC is **measurable** — computable from a concrete evidence source — **not
that it is the correct requirement.** Per [Microsoft Research 2026 — Intent Formalization](https://www.microsoft.com/en-us/research/publication/intent-formalization-a-grand-challenge-for-reliable-coding-in-the-age-of-ai-agents/):
_"There is no oracle for spec correctness."_ Measurability is **necessary, not sufficient**. The
**Manager remains the intent oracle** via the human-in-the-loop step. This tool's job is narrow and
honest: reduce _aspirational_ ACs ("improve quality", "make it robust"), not auto-validate intent.

## Evidence sources (the reconciler taxonomy)

An AC is measurable iff its text anchors to one of:

| Source | Anchor the classifier looks for | Example |
|---|---|---|
| `file_existence` | a file path (`*.js/.ts/.py/.md/.json/.yml/.sh/...`) | "ships `scripts/global/ac-suggest.js`" |
| `closed_child` | a child issue `#N` | "child #1302 closed" |
| `sensor_output` | a **numeric** metric / threshold | "p99 latency `<200ms`", "coverage `>= 80%`" |
| `native_github_api` | observable GitHub state | "PR merged", "`status:done` label", "CI green" |

A metric _word_ without a number ("improve latency", "good coverage") is treated as **aspirational**
— the backstop is deliberately conservative (favors precision over recall): better to reject a
vaguely-phrased measurable AC than accept an aspirational one. Re-phrase with a concrete anchor.

## Usage

```bash
# Interactive HITL — per-AC accept / edit / reject:
node scripts/global/ac-suggest.js --problem "Add a dashboard panel showing fleet utilization"

# Non-interactive (agent callers) — JSON verdicts:
node scripts/global/ac-suggest.js --json --problem "..."
npm run ac-suggest -- --json --problem "..."

# From a file:
node scripts/global/ac-suggest.js --problem-file ./problem.md
```

The `--json` output has `{ source, accepted[], rejected[], verdicts[] }`. `source` is the lane that
answered: a fleet/free-cloud provider id, or `offline-fallback`.

## When to use AI suggestion vs. hand-write

| Use AI suggestion when… | Hand-write when… |
|---|---|
| Starting a fresh Epic and want a measurable first draft | You already have precise, measured ACs |
| ACs keep coming out aspirational across Epics | The Epic is research-first / exploratory (intent still forming) |
| You want a consistency check on AC measurability | A single trivial config/typo change (no Epic) |

Either way, **review every AC.** The tool drafts and filters; it does not decide intent.

## Cost & resilience

- **G3 zero-cost**: suggestion runs on the free fleet lane, failing over to the free-cloud `$0`
  providers (#2619). It **never** uses a paid provider for AC suggestion.
- **G6 resilience**: if no LLM lane answers, a deterministic offline fallback extracts
  measurable-looking clauses from the problem statement — the tool still works air-gapped.

## Measurement (replay-eval, not calendar)

`scripts/global/ac-suggest-replay-eval.js` scores the classifier against
`tests/fixtures/ac-suggest-corpus.json` (labeled measurable / aspirational, with true negatives):

```bash
npm run ac-suggest:replay-eval          # human-readable: precision / recall / TN-rate / FP-rate
npm run ac-suggest:replay-eval -- --json
```

The **AC5 bar is FP-rate < 5%** (AI ACs the backstop passes but are truly unmeasurable). Promotion
of the backstop from advisory to blocking is **precision-gated against this corpus, not wall-clock**
(per `instructions/test-methodology-matrix.instructions.md` — replay-eval over calendar waits,
Epic #1771/#1827). Grow the corpus from real suggestions; re-run the eval; the bar gates promotion.
