# Fleet Model Upgrades Implementation — 2026-05-01

Last updated: 2026-05-01

| Host | Primary model | Warm tok/s | New model benchmarked | Result |
| --- | --- | ---: | --- | --- |
| 36gbwinresource | `starcoder2:3b` Q4_0 | 80.48 | `qwen2.5-coder:7b-instruct-q3_K_S` at 14.77 | Throughput target cleared |
| windows-laptop | `qwen2.5-coder:1.5b` Q4_K_M | 8.36 | `starcoder2:3b` at 4.12 | Throughput target cleared |

## Summary

- Confirmed `OLLAMA_KEEP_ALIVE=24h` on both Windows hosts via machine-scope env probe.
- Reconciled `inventory/devices.json` to the live `/api/tags` responses from both hosts.
- Installed and benchmarked new coding models on OpenClaw (`starcoder2:3b`, `granite-code:3b`, `qwen2.5-coder:1.5b`).
- Confirmed `qwen3-coder:4b` is not available in Ollama on 36gbwinresource; retained evidence in inventory notes and ADR.
- Verified OpenClaw port 4000 is healthy and updated repo-side LiteLLM aliases to current installed models.

## Provider Probe Snapshot

| Provider | Result |
| --- | --- |
| OpenRouter | `200` model-list response |
| Google AI Studio | `200` model-list response |
| Groq | `200` model-list response |
| Cerebras | `200` model-list response |

## Actionable Next Steps

1. Deploy updated LiteLLM config to windows-laptop from this branch after merge.
2. Keep `starcoder2:3b` as the 36gb low-latency route and `qwen2.5-coder:7b-instruct-q3_K_S` as the quality tier.
3. Keep `qwen2.5-coder:1.5b` as the OpenClaw primary until a newer CPU-fit coder clears 8+ tok/s.
