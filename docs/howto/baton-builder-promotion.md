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

**No calendar threshold.** Do not promote "after N days". Promote when the
full-corpus `rate` crosses the gate. Expand the seed corpus
(`tests/fixtures/baton-replay/corpus.json`) with mined real artifacts before
treating a run as the promotion decision.

### Current state (advisory)

The committed seed corpus is illustrative (4 entries, rate 0.75 < 0.85), so the
gate is **not met** and the default **remains opt-in**. This is the correct state:
the harness and gate are in place; the default flips only after the corpus is grown
with real historical artifacts and the rate crosses 0.85.

## The env flag (opt-in now, rollback later)

`MEGINGJORD_BATON_BUILDER_DEFAULT` (`baton-builder-mode.js`):

| Value | Meaning |
|---|---|
| unset / `0` / `false` | legacy path is default (current advisory state) |
| `1` / `true` / `on` / `yes` | use the programmatic builder as the default path |

```js
const { isBuilderDefault, promotionState } = require('./scripts/global/baton-builder-mode');
if (isBuilderDefault()) { /* builder path */ } else { /* legacy path */ }
```

The **same flag is the rollback switch** after promotion: when the default flips
(a doc + default change, no code change), operators set the flag to `0` to fall back
to the legacy path. G6 resilience: promotion is reversible without a revert.

## Related

- `scripts/global/baton-replay-eval.js` — the gate harness
- `scripts/global/baton-builder-mode.js` — the env flag
- `docs/howto/irreducible-slot-contract.md` (#2673) — the 3 free-text slots the builders preserve
- `tests/baton-artifact-cross-runtime.spec.js` (#2674) — the byte-identical invariant the builders satisfy
