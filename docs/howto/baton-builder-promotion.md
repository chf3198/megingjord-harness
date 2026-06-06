# Baton-Builder Promotion (Epic #2037 P1.5, #2675)

The programmatic baton-artifact builders (`baton-artifact-builder.js` #2671,
`baton-pr-builders.js` #2672) ship **opt-in**. The legacy hand/template path stays
the default until a **replay-eval gate** is met — promotion is gated on reproduction
fidelity, **not a calendar threshold** (per #1771 / #1875; mirrors #2111).

## The promotion gate

Promote the builders to the default path once `baton-replay-eval.js` reproduces
**≥ 85%** of the historical baton-artifact corpus byte-identical from reconstructed
structured input:

```js
const { replayEval, meetsGate } = require('./scripts/global/baton-replay-eval');
const corpus = require('./tests/fixtures/baton-replay/corpus.json');
const result = replayEval(corpus);           // { total, matched, rate, mismatches }
const promote = meetsGate(result.rate);       // rate >= 0.85
```

- `rate` is the fraction of corpus entries the builder reproduces exactly.
- `mismatches` lists the entries that did NOT reproduce — these are historical
  artifacts with format drift (extra whitespace, field reordering, prose collisions)
  that the builder intentionally normalizes. They are the signal of *how much*
  historical practice diverged from the canonical form, not bugs in the builder.

**Definition — "canonical-form artifact":** a posted artifact whose parsed structured
input `buildArtifact` accepts (all required fields present) AND re-renders byte-identical.
The committed corpus is the *valid* canonical artifacts; the gate measures the builder's
forward-consistency (does it deterministically reproduce well-formed artifacts), NOT
reproduction of pre-canonical or schema-invalid history. A parse that yields a fields-less
or required-field-missing input is therefore a non-canonical artifact (a defect signal),
not a builder reproduction failure.

**No calendar threshold.** Do not promote "after N days". Promote when the
full-corpus `rate` crosses the gate. Expand the seed corpus
(`tests/fixtures/baton-replay/corpus.json`) with mined real artifacts before
treating a run as the promotion decision.

### Current state (PROMOTED — #2692)

The committed corpus is **real mined artifacts** (`baton-replay-mine.js` parses posted
baton comments back into structured input). Over the 17 valid canonical artifacts mined
from closed tickets #2671–#2675 the builder reproduces **17/17 = 1.00** byte-identical;
the literal-blended rate including 3 schema-invalid stale-tool empties (a separate defect
filed as #2693) is **0.85**. Either way `meetsGate` is true, so the builders were
**promoted to the default path** (fleet-decision-oracle approved per #2509).

Mining caveat (honesty): pre-builder artifacts authored by other runtimes (e.g. an
Antigravity/gemini MANAGER_HANDOFF used `### ` headers + `*   **field**:` markdown bullets)
do **not** parse as canonical and reproduce at ~0 — they are exactly the cross-model
format divergence this Epic eliminates, not a builder defect. The gate therefore measures
reproduction of *canonical-form* artifacts (forward-consistency), not reproduction of
pre-canonical history.

## The env flag (opt-in now, rollback later)

`MEGINGJORD_BATON_BUILDER_DEFAULT` (`baton-builder-mode.js`):

**PROMOTED (#2692):** the builder is now the DEFAULT path; the flag is the ROLLBACK switch.

| Value | Meaning |
|---|---|
| unset / `1` / `true` / `on` / `yes` | **builder is the default path** (post-promotion default) |
| `0` / `false` / `off` / `no` | explicit rollback to the legacy hand/template path |

```js
const { isBuilderDefault, promotionState } = require('./scripts/global/baton-builder-mode');
if (isBuilderDefault()) { /* builder path (default) */ } else { /* legacy path (rolled back) */ }
```

G6 resilience: rollback is a single env-var change (`MEGINGJORD_BATON_BUILDER_DEFAULT=0`),
not a code revert.

## Related

- `scripts/global/baton-replay-eval.js` — the gate harness
- `scripts/global/baton-builder-mode.js` — the env flag
- `docs/howto/irreducible-slot-contract.md` (#2673) — the 3 free-text slots the builders preserve
- `tests/baton-artifact-cross-runtime.spec.js` (#2674) — the byte-identical invariant the builders satisfy
