# Irreducible-3 Slot Contract (Epic #2037 P1.3, #2673)

Epic #2037 schema-renders baton artifacts so the operator cannot introduce
format defects (signer invention, Refs-ordering, title-length, prose collisions).
Most artifacts are **fully** deterministic (see #2671 comment artifacts, #2672
PR/CHANGELOG/commit-trailer artifacts). Three cases are **irreducible**: they
genuinely need one LLM free-text slot each, because they require judgment or
synthesis that no schema can render.

This contract names, per case, the **structured** (schema-rendered, deterministic)
fields and the **single free-text slot** — and a validator
(`scripts/global/baton-slot-contract.js`) asserts that *only* the named slot is
free-text. Everything else is single-line `key: value`, so format defects cannot
leak into the structured portion.

## The three cases

| Case | Structured fields (deterministic) | Free-text slot | Why irreducible |
|---|---|---|---|
| `PER_AC_VERIFICATION` | `ac_id`, `verdict` | `narrative` | "how I verified it" is per-AC judgment prose |
| `CONSULTANT_EPIC_CLOSEOUT` | `epic`, `children_closed`, `verdict`, `rubric_rating` | `synthesis` | cross-child synthesis is genuine LLM reasoning |
| `ANNEAL_DECISION` | `flaw`, `decision` (enum), `artifact` | `rationale` | the "why" behind a flaw-recognition decision |

`ANNEAL_DECISION.decision` is enum-checked against the flaw-recognition decision
set (`file-ticket | log-incident-only | memory-note-only | no-action-justified`,
per `instructions/role-baton-routing.instructions.md`).

## API

```js
const { renderWithSlot, validateSlotContract } = require('./scripts/global/baton-slot-contract');

// Validate: only the named slot may be free-text; non-slot fields single-line + known.
const { ok, violations, slot } = validateSlotContract('PER_AC_VERIFICATION', fields);

// Compose: deterministic structured block + the single free-text slot under a heading.
const text = renderWithSlot('ANNEAL_DECISION', {
  flaw: 'mergeEvidence pass-through unvalidated', decision: 'file-ticket',
  artifact: '#2672', rationale: 'structural gap; encode the gate form as data',
});
```

## Validator rules (AC2)

`validateSlotContract(caseName, fields)` flags a violation when:

- a field is neither a structured field nor the named slot (`unknown field`);
- the named slot is missing or empty;
- a **structured field contains a newline** — narrative belongs in the slot, not here;
- (`ANNEAL_DECISION` only) `decision` is not in the enum.

`renderStructured` throws on a missing/empty structured field;
`renderWithSlot` throws if the contract is violated.

## Goal-lens

- **G1/G2**: bounds the free-text surface to exactly three named slots — every other
  baton field is deterministic, so the LLM-format-defect class is structurally excluded
  outside the slots.
- **G8**: non-slot fields are single-line `key: value`, trivially auditable/diffable.

## Related

- `scripts/global/baton-artifact-builder.js` (#2671) — comment-artifact renderer
- `scripts/global/baton-pr-builders.js` (#2672) — PR/CHANGELOG/commit-trailer renderer
- `instructions/role-baton-routing.instructions.md` — anneal decision set + closeout schema
