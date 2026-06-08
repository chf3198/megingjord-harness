# Provider-Neutral Routing

The global task router chooses a capability lane. It does not choose a runtime
or make one provider family canonical.

## Concepts

- **Runtime**: the agent surface, such as Codex, Copilot, or Claude Code.
- **Lane**: the required capability/cost tier: free, fleet, haiku, or premium.
- **Provider**: the serving path, such as Anthropic, OpenAI-compatible, Ollama,
  OpenRouter, LiteLLM, or fleet.
- **Model family**: the vendor/model lineage selected by the provider adapter.

## Lane Names

| Lane | Capability tier | Purpose |
|---|---|---|
| Free | `free-auto` | Lookup, docs, simple analysis |
| Fleet | `fleet-coding-local` | Local/fleet coding and known-pattern edits |
| Haiku | `balanced-cloud` | Mid-complexity review, tests, single-file work |
| Premium | `frontier-reasoning` | Architecture, security, ambiguous debugging |

## Adapter Boundary

Provider-specific model IDs live in
`scripts/global/routing-provider-adapters.json`. Current adapters include
Anthropic, OpenAI-compatible, Ollama, OpenRouter, LiteLLM, and fleet paths.
Anthropic remains available as a default cloud adapter, but it is no longer the
visible definition of a paid lane.

## Capability Registry

Provider and runtime capability claims live in
`scripts/global/provider-capability-registry.json`. The generated operator view
is `docs/provider-capability-registry.md` and can be refreshed with
`node scripts/global/provider-capability-registry.js --write-doc`.

Runtime records describe agent surfaces. Provider records describe serving
paths. Keep those ownership boundaries separate when comparing Codex, Copilot,
Claude Code, HAMR, OpenClaw, OpenRouter, Ollama, LiteLLM, or vendor APIs.

## Layer-2 Coordination Routing

Cross-agent coordination (mailbox, bundles, telemetry) is separate from the
LLM inference lane above. It uses `github-native-client.js` for routing:

| Path | Default (Tier-1) | Opt-in (Tier-2) |
|---|---|---|
| Mailbox | `github-mailbox.js` via GitHub Issues | HAMR `/mailbox/*` |
| Bundles | `github-bundle-client.js` via Releases | HAMR `/bundle/*` |
| Telemetry | `github-telemetry-read.js` via Actions artifact | HAMR `/quota` |
| Async dispatch | `github-mcp-dispatch.js` via `repository_dispatch` | HAMR MCP |

Toggle: `MEGINGJORD_HAMR_ENABLED=1` activates Tier-2. Default is Tier-1
(GitHub-native, zero paid infrastructure). See `docs/howto/github-native-layer2.md`.

## Validation

Routing changes should include:

- JSON parse coverage for policy and adapter files.
- Targeted router tests for classification and dispatch behavior.
- Drift notes when lane names or adapter semantics change.

Signed-by: Quill Harper
Team&Model: codex:gpt-5.4@codex-cli
Role: collaborator
