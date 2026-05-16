# Canonical Governance Adapters

Date: 2026-05-16  
Last-updated: 2026-05-16

## Summary

| Item | Value |
|---|---|
| Canonical manifest | `inventory/governance-manifest.sample.json` |
| Schema | `inventory/governance-manifest.schema.json` |
| Adapter emitter | `scripts/global/governance-adapter-emit.js` |
| Output root | `generated/governance-adapters/` |

## What the emitter does

The adapter emitter converts the canonical manifest into deterministic, target-native previews for:
- Copilot → `.github/instructions/*.instructions.md`
- Cline → `.clinerules/*.md`
- Claude Code → `CLAUDE.md`
- Continue → `.continue/rules/*.md`

Each generated file includes:
- provenance header
- target metadata
- frontmatter with `applyTo`/`paths`
- canonical source reference via `bodyRef`

## Validation

- `npm run governance:adapters:emit`
- `npm run governance:adapters:test`

## Output behavior

- Only units whose `targets` include a given runtime are emitted
- Emission is deterministic for the same manifest
- Generated previews are written under `generated/governance-adapters/<target>/...`

## Next steps

1. Add sync-check generation in CI (#1695).
2. Add parity matrix/golden tests across target outputs (#1696).
3. Use these previews as the reference for migration (#1698).
