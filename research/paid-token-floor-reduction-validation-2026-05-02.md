# Paid-Token Floor Reduction Validation — 2026-05-02

Last updated: 2026-05-02

| Validation area | Result | Evidence source |
| --- | --- | --- |
| Fleet availability | ✅ | `.dashboard/capabilities.json` shows `36gbwinresource`, `windows-laptop`, and `penguin-1` reachable |
| OpenClaw gateway | ✅ | `GET http://100.78.22.13:4000/health/liveliness` -> `"I'm alive!"`; chat completion returned `pong` |
| 36gbwinresource utilization | ✅ | `test-results/fleet-benchmark-772.json` recorded `starcoder2:3b` cold 72.83 tok/s |
| windows-laptop utilization | ✅ | `test-results/fleet-benchmark-772.json` recorded `qwen2.5-coder:1.5b` cold 8.34 tok/s |
| OpenRouter availability | ✅ | `.dashboard/capabilities.json` provider `openrouter` status `http_status: 200` |
| Google AI Studio availability | ✅ | `scripts/quota-probes.js` output: active, 50 models |
| Groq availability | ✅ | `scripts/quota-probes.js` output: rate-limit headers present |
| Cerebras availability | ✅ | `scripts/quota-probes.js` output: active, 4 models |

## Summary

This validation run confirms that the free-tier architecture proposed in Epic #782 is currently operational across both fleet and cloud surfaces. The fleet side demonstrates active and performant inference on 36gbwinresource and windows-laptop, while OpenClaw remains available for routed local execution. Cloud-side probes confirm healthy access for OpenRouter, Google AI Studio, Groq, and Cerebras under current credentials.

## Design Implications for Epic #782

1. Move 1 (free-model orchestrator) is still viable: all free-provider endpoints remained reachable in this validation window.
2. Move 2 (repo-context RAG on penguin-1) remains viable: penguin-1 reachable and embedding-capable models visible in the capability manifest.
3. Move 3 (state offload MCP) remains viable: the fleet/cloud substrate needed to support low-cost orchestration and retrieval is currently healthy.
4. Move 0 (gateway-first caching) remains the fastest route to immediate paid-token reduction and should remain first in rollout order.

## Actionable Next Steps

1. Close Epic #782 as research-complete with this validation evidence and existing design matrix in `research/paid-token-floor-reduction-2026-05-01.md`.
2. Keep weekly capability+quota probes scheduled so availability regressions are caught before orchestrator routing changes.
3. Route implementation sequencing through the existing child tickets and keep release evidence tied to fleet/cloud probe artifacts.
