# Fleet Capability Tagging Research

**Date**: 2026-04-28  
**Ticket**: #562  
**Last Updated**: 2026-04-28

## Summary Table

| Area | Finding | Implication for DevEnv Ops |
|---|---|---|
| Karpathy Wiki inventory | [[model-routing]] and [[devenv-fleet-topology]] are stale for new GPU host | Router cannot safely infer best node from docs alone |
| Current harness schema | `inventory/devices.json` has hardware facts, no routing tags | Must add router-readable capability taxonomy |
| LiteLLM/Ollama ecosystem | Routing generally selects by model, metadata, health | Device metadata layer is required before model dispatch |
| Scheduler patterns (K8s/Slurm) | Label + selector approach is durable for heterogeneous nodes | Use stable enums over free-text notes |
| Cost control strategy | Route coding tasks to strongest local node first | Reduces premium cloud spillover and token spend |

## Internal Wiki Evidence Reviewed

- [[model-routing]]: describes windows-laptop as primary local routing surface.
- [[context-flow]]: confirms lane model but not capability-aware device selection.
- [[devenv-fleet-topology]]: still three-device topology, missing 36gbwinresource.
- [[karpathy-llm-wiki-pattern]]: supports structured, linked markdown as source-of-truth.

## Detailed Findings

1. **Schema gap is the blocker**: `task-router.js` scores lanes only; it does not pick a target device.
2. **Inventory gap is material**: 36gbwinresource is not represented in `inventory/devices.json`.
3. **Governance gap exists**: wiki and inventory can drift without an enforced metadata contract.
4. **Best-practice match**: capability labels (`capabilities[]`) + selectors (`requires[]`) are simpler than embedding model-specific routing rules in every script.
5. **Operational fit**: static JSON metadata is consistent with the no-build architecture.

## Proposed Tag Vocabulary Candidates

- `routing.tier`: `micro` | `standard` | `performance`
- `routing.inferenceClass`: `tiny` | `general` | `coding` | `heavy-coding`
- `routing.capabilities[]`: e.g., `gpu-inference`, `ollama`, `openclaw-gateway`
- `routing.modelClass[]`: `sub-2b`, `7b`, `8b-14b`
- `routing.priority`: numeric tie-break among same-class nodes

## Actionable Next Steps

1. Approve ADR for canonical capability schema (Ticket #563).
2. Apply tags to all devices and add 36gbwinresource (Ticket #564).
3. Make router select top matching device by `inferenceClass` + `priority` (Ticket #565).
4. Refresh wiki pages and entity docs from inventory truth (Ticket #566).

## Sources

- [wiki/concepts/model-routing.md](../wiki/concepts/model-routing.md)
- [wiki/concepts/context-flow.md](../wiki/concepts/context-flow.md)
- [wiki/sources/devenv-fleet-topology.md](../wiki/sources/devenv-fleet-topology.md)
- [scripts/global/task-router.js](../scripts/global/task-router.js)
- [inventory/devices.json](../inventory/devices.json)