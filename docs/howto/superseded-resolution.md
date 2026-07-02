# Superseded resolution — closure-reason taxonomy (F6)

_Ticket: #3525 · Epic: #3517 · Design: [ADR-020](../../research/adr/020-closure-readiness-resurfacing.md) §D3 · Decision: [D-0002](../decisions.md)_

The harness closes work with an honest terminal **reason**. Before #3525 the taxonomy
carried `completed | released | duplicate | research-delivered` only — work whose
capability shipped elsewhere had no honest reason, so it stayed open by default. F6 adds
`resolution:superseded`.

## Reason disambiguation

| Reason | Meaning | Distinct because |
|---|---|---|
| `resolution:completed` | done as specified | work was performed |
| `resolution:released` | shipped to main/prod | deployment milestone |
| `resolution:duplicate` | same scope already tracked | **identity** with another ticket |
| `resolution:research-delivered` | research finding delivered | research-lane terminal |
| **`resolution:superseded`** | scope no longer needed; overtaken by events | **not identical** (vs duplicate), **not performed** (vs completed) |

## Ownership boundary

- **Detection** — "is #N semantically superseded by #M?" — is owned by the **#3398 / #3420**
  lane (cross-model semantic match). This ticket does **not** rebuild it.
- **Apply-decision** — "given a verdict, may we apply `resolution:superseded` and close?" — is
  owned here: the pure function `scripts/global/superseded-resolution.js`
  (`decideSupersededResolution`). Surface-only invariant **I0**: it never auto-closes on
  uncertainty; degraded/ambiguous input **fails closed** to `no-op` or `route-contested`.

## The six false-positive controls

1. **Two-signal rule** — apply requires a confirmed #3398 verdict **and** a resolvable
   `SUPERSEDED_BY: #M` that actually exists.
2. **Evidence guard** — missing / unresolvable `#M` → `signal:contested-superseded`, never close.
3. **Self-supersession block** — `#M` may not be the item itself or a descendant → contested.
4. **Reversibility** — an applied superseded-close carries `reopenOn: #M`, so it auto-reopens
   if `#M` is later reopened.
5. **Appeals path** — a contested verdict gets `signal:contested-superseded` and routes to the
   **#2990** propose-only queue for a Manager verdict (no auto-close).
6. **Acyclic guard** — the `SUPERSEDED_BY` chain must be a DAG; a mutual (`A↔B`) or longer cycle
   means neither item is truly overtaken → contested for human adjudication.

## Decision outcomes

`decideSupersededResolution(input)` returns exactly one of:

- `apply-superseded` — apply `resolution:superseded`, add `SUPERSEDED_BY: #M` body line, close;
  carries `reopenOn: #M`.
- `route-contested` — apply `signal:contested-superseded`, enqueue to #2990; **never closes**.
- `no-op` — verdict not confirmed, or degraded input (fail-closed); no signal emitted.

## Labels (see `scripts/global/label-manifest.json`)

- `resolution:superseded` — terminal reason (group `resolution`).
- `signal:contested-superseded` — additive appeals flag (group `signal`; coexists with the
  lifecycle `status:*` label — hence the `signal:*` namespace per **D-0002**, not `status:*`).

Tests: `tests/superseded-resolution.spec.js` (all six controls + fail-closed).
