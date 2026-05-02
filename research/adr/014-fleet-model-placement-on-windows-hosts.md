# ADR-014: Fleet model placement on Windows hosts

**Status**: Accepted
**Date**: 2026-05-01

## Context

Issue #765 required throughput recovery on both Windows fleet hosts, replicable install scripts, and alignment between inventory, LiteLLM aliases, and the real `/api/tags` state. Measured 7B coding models regressed on both hosts, while smaller models cleared the target on the available CPU/GPU envelopes.

## Decision

- Use `starcoder2:3b` Q4_0 as the primary low-latency coding model on `36gbwinresource`.
- Keep `qwen2.5-coder:7b-instruct-q3_K_S` as the higher-quality 4GB-safe coding tier on `36gbwinresource`.
- Use `qwen2.5-coder:1.5b` Q4_K_M as the primary coding model on `windows-laptop`.
- Expose OpenClaw LiteLLM aliases for `fleet-primary`, `fleet-fast`, and `fleet-quality` to match those installed models.
- Reject `qwen3-coder:4b` for this rollout because the Ollama registry did not provide a manifest at rollout time.

## Consequences

- The fleet now meets the throughput goal with evidence-based smaller coding models instead of stale 7B defaults.
- Inventory and wiki entries describe actual deployed models, reducing routing and operations drift.
- Quality-sensitive work can still route to larger fallback models when latency is secondary.
