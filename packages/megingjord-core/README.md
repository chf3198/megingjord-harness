# @megingjord/core

Pure, dependency-free governance primitives shared by the Megingjord VS Code /
Cursor / Antigravity extension host and its companions (Hybrid Option C — Epic #2508).

This package has **no `vscode` dependency** — it is the "core" layer of the migration
(Phase-1 P1-a). The extension host (`megingjord-core-ext`, P1-b) imports it and
re-exposes `MegingjordCoreApi` via its `activate()` return so companions can consume it
through `extensionDependencies` + `getExtension('megingjord.megingjord-core').exports`.

## Surface (v0.0.1)

- `createCore(): MegingjordCoreApi` — factory.
- `goalLens` — the G1…G10 priority order with `rank()` / `compare()`.
- `classifyCarveOut(text)` — maps a decision to one of the four retained human
  touchpoints (`design | uat | irreversible | security-weakening`) or none.
- `isRetainedTouchpoint(text)` — true when a decision must reach the client.

The contract is **versioned** (`version`); consumers check compatibility and degrade
gracefully (G6). No credentials cross this boundary (G4).
