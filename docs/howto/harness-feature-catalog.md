# Harness Feature Catalog (Epic #3411 T1.1)

The canonical harness feature catalog is the machine-readable single source of truth for every
harness feature/surface and its per-orchestrator parity contract. One-step onboarding (T2) and the
per-feature × per-orchestrator parity matrix (T3) derive from it.

## Files

- `inventory/harness-feature-catalog.json` — the catalog (19 layers, feature rows). Derived from the
  Phase-0 #3412 synthesis (`research/cross-orchestrator-parity-phase0-3412.md`).
- `inventory/harness-feature-catalog.schema.json` — draft-2020-12 JSON Schema (parityCell `$defs`
  with a required `substituteTest` on `structural-NA`/`waived` cells).
- `scripts/global/harness-feature-catalog.js` — zero-dependency loader/validator.

## Usage

```bash
npm run catalog:check          # validate + print derived counts
node scripts/global/harness-feature-catalog.js --json   # machine-readable result
node scripts/global/harness-feature-catalog.js --fix    # recompute derived counts + catalogVersion
npm run catalog:check:test     # golden test
```

## Invariants (enforced by the validator)

- `catalogVersion` is `sha256(canonical(layers+features))[:16]`; stale versions fail.
- Counts in `metadata` must equal the values **derived** from `features` (never hand-asserted).
- `ssotAnchor` must be `governance/README.md` and that file must exist — the catalog EXTENDS the
  #1701 governance-manifest chain, it does not fork it.
- Every `parity: "yes"` feature carries a `perRuntime` cell for all 5 runtimes.
- Every `structural-NA`/`waived` parity cell carries a non-empty `substituteTest`.

## What's next

- T1.3 (#3441) reconciler populates the `unverified` `perRuntime` cells from live registry state.
- T3.1 (#3451) parity matrix live-probes each cell via the catalog `enforcement` block.
