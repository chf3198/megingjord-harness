# ADR-028: Fleet Capability Tag Schema for Router-Aware Selection

**Status**: Accepted
**Date**: 2026-04-28

## Context

Fleet routing is lane-based but not capability-aware. Adding or upgrading devices
requires hardcoded edits in scripts and docs. The harness now includes a stronger
GPU node (36gbwinresource) that should be auto-selected for heavy local coding.

## Decision

Add a `routing` block to every device in `inventory/devices.json`.

```json
"routing": {
  "tier": "micro|standard|performance",
  "inferenceClass": "tiny|general|coding|heavy-coding",
  "capabilities": ["ollama", "gpu-inference"],
  "modelClass": ["sub-2b", "7b", "8b-14b"],
  "priority": 0,
  "preferredFor": ["implement", "refactor", "tests", "batch"]
}
```

Router contract:
- Determine lane as today.
- For `fleet` lane, select reachable device with highest `priority` among devices
  matching keyword class via `preferredFor` and `inferenceClass` fit.
- Emit `targetDevice` and `targetOllamaUrl` in router output.

Governance contract:
- Device onboarding/update must include `routing` tags.
- Wiki model-routing/topology pages must be updated in same tranche.

## Consequences

Positive:
- Removes device-name hardcoding from routing choices.
- Enables deterministic, auditable task→resource selection.
- Improves cloud-cost control by preferring strongest local resource.

Trade-offs:
- Requires metadata hygiene when devices change.
- Requires periodic verification that `priority` still reflects reality.