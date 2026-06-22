# Architecture — Routing and Capability Detection

Routing is the core of Megingjord's cost-optimisation strategy (G3 Zero Cost).
The cascade-dispatch always tries free/local tiers before paid cloud providers.

## Cascade dispatch (ADR-012)

`scripts/global/cascade-dispatch.js` implements a four-tier priority cascade:

| Priority      | Tier    | Providers                                    |
| ------------- | ------- | -------------------------------------------- |
| 1 (cheapest)  | Free    | Gemini via Google AI Studio free quota       |
| 2             | Fleet   | Ollama models on Tailscale hosts (local GPU) |
| 3             | Budget  | Claude Haiku, GPT-3.5-class, Groq            |
| 4 (costliest) | Premium | Claude Sonnet/Opus, GPT-4-class              |

The cascade evaluates tiers in order and uses the first available, healthy tier
that can handle the task's context length and required capabilities.

## Free router

`scripts/global/free-router.js` sits in front of cascade-dispatch:

1. Runs a lightweight topic classifier to estimate task difficulty
2. Builds a signal stack (context length, tool requirements, sensitivity)
3. Dispatches directly to the appropriate tier — skips cascade overhead
4. Falls back to cascade-dispatch if the signal stack is ambiguous

## Model routing policy

`scripts/global/model-routing-policy.json` — capability matrix keyed by
task type × provider. Defines lane order, timeout caps, and fallback rules.

Key task types: `code-edit`, `code-review`, `doc-write`, `governance-check`,
`wiki-ingest`, `fleet-health`, `telemetry-read`.

## Task router

`scripts/global/task-router-dispatch.js` — direct dispatch to a named tier,
bypassing the cascade. Used by governance workflows that need deterministic
model selection (e.g. `governance-check` lane always uses a specific model).

## Capability detection (ADR-013)

`scripts/global/capability-probe.js` probes each provider at startup:

1. Checks API key availability via `credential-availability.js`
2. Pings model endpoint with a minimal test prompt
3. Caches result in `.dashboard/state/capability-cache.json`

`capability-show.js` displays the cached probe result in CLI format.

## Fleet architecture

Fleet hosts are resolved via `scripts/global/resolve-inventory.js` from `inventory/*.example.json` + `~/.megingjord/` overlay:

```json
{
  "hosts": [
    {
      "id": "36gbwinresource",
      "tailscale_ip": "...",
      "gpu": "RTX 4090",
      "models": ["llama3.3", "qwen2.5-coder"]
    },
    { "id": "openclaw", "tailscale_ip": "...", "gpu": "M3 Max", "models": ["llama3.3:7b"] },
    { "id": "penguin-1", "tailscale_ip": "...", "cpu_only": true, "models": ["phi3-mini"] }
  ]
}
```

Fleet routing rules (from `model-routing-policy.json`):

- Tasks within available model context window → fleet first
- Tasks requiring tool use → cloud (fleet Ollama models lack tool support)
- Fleet unavailable (health check fails) → cascade to cloud with G3 cost note

`scripts/health-check.js` pings all hosts and writes `.dashboard/state/fleet-health.json`.

## RAG search

`scripts/global/rag-search.js` — repo-context search for wiki ingest and
governance queries. Priority: MCP server → ripgrep → Node `fs` glob.

## State offload

`scripts/global/state-offload-client.js` — offloads per-turn state to a
Cloudflare Worker. Keeps hot-path context under model context limits without
losing long-horizon state across turns.
