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

## Validation

Routing changes should include:

- JSON parse coverage for policy and adapter files.
- Targeted router tests for classification and dispatch behavior.
- Drift notes when lane names or adapter semantics change.

Signed-by: Quill Harper
Team&Model: codex:gpt-5.4@codex-cli
Role: collaborator
