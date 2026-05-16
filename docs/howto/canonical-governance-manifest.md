# Canonical Governance Manifest — How-To

Date: 2026-05-16  
Last-updated: 2026-05-16

## Summary

| Item | Value |
|---|---|
| Schema file | `inventory/governance-manifest.schema.json` |
| Sample manifest | `inventory/governance-manifest.sample.json` |
| Validator | `scripts/global/governance-manifest-validate.js` |
| Command | `npm run governance:manifest:validate` |

## What this defines

A runtime-agnostic governance unit format with required metadata:
- `id`, `title`, `priority`, `appliesTo`, `targets`, `tags`, `bodyRef`
- `targets` supports Copilot, Cline, Claude Code, Continue
- `bodyRef` points to source markdown/instruction files in this repo

## Validation behavior

- Exit `0`: manifest valid
- Exit `1`: manifest invalid (diagnostics printed)
- Exit `2`: runtime/read error

Example diagnostics:
- `units[0].priority invalid`
- `units[1].bodyRef not found: instructions/missing.md`

## Usage

1) Validate sample:
- `npm run governance:manifest:validate`

2) Validate a custom manifest:
- `node scripts/global/governance-manifest-validate.js ./path/to/manifest.json`

## Adapter mapping readiness

`targets` is explicit per unit, enabling adapter emitters to map units for:
- `copilot`
- `cline`
- `claude-code`
- `continue`

## Source links

- Issue scope: #1693
- Research input: #1692
- Epic parent: #1701

## Actionable next steps

1. Implement adapter emitters (#1694) using `targets` and `bodyRef`.
2. Add generate/sync commands and CI drift gates (#1695).
3. Add matrix/golden parity tests across outputs (#1696).
