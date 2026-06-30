# Guardrail-first anneal — friction routing (operator guide)

Part of Epic #3380. Implements the Phase-0 design in `research/guardrail-first-anneal-routing-3380.md`.

## Why
A memory note is cheap to write and expensive forever — re-loaded every session (token tax),
recalled by embedding similarity (semantic ≠ causal → wrong-workaround thrash), and never fixes the
defect. For a *recurring, deterministic* friction the right disposition is a **guardrail** (hook /
validator / CI / test) that prevents the friction for **all** teams. Memory is reserved for genuine
judgment/preference; one-off events decay.

## The classifier
`scripts/global/friction-classifier.js` exposes `classifyFriction(record, opts) -> { destination,
confidence, signals, ambiguous? }`. Destinations:

| Destination | When |
|---|---|
| `guardrail-candidate` | mechanical surface named (gate/hook/validator/regex/state-file…) AND recurrence ≥ 2 AND severity ≥ medium |
| `skill` | a correct, reusable multi-step procedure (≥ 3 ordered steps), not a defect |
| `semantic-memory` | judgment / preference / client directive / external fact — **wins on collision** |
| `forget` | one-off below the recurrence floor (decays in incidents.jsonl) |

**Anti-over-route:** a record that names a mechanical surface *and* hits the judgment lexicon (or
`trigger_role: client`) routes to `semantic-memory` with `ambiguous: true` — a preference is never
auto-converted into a blocking guardrail. Unknown/error inputs **fail open** to `semantic-memory`.

## Usage
```bash
node scripts/global/friction-classifier.js '{"_summary":"merge-gate false-block","gate":"merge-gate","recurrence_7d":3,"severity":"high"}'
node scripts/global/friction-classifier-replay-eval.js --report   # precision/recall vs the labeled corpus
```

Lexicon terms live in `config/friction-lexicon.json` (data, not code — extend without a code change).
Promotion of any downstream guardrail from advisory to blocking is gated on replay-eval precision
≥ 0.85 against `tests/fixtures/friction-corpus.json`, never on a calendar threshold.
