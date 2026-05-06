---
title: Fleet & Cloud Resource Optimization — Research & Design
date: 2026-05-06
epic: 949
research-ticket: 950
authored-by: operator-deputy (Claude Code Team runtime)
status: COMPLETE — pending CONSULTANT_CLOSEOUT
---

# Fleet & Cloud Resource Optimization — R&D

## Re-scoped mandate

Per Manager re-scope on #949 (May 6), this R&D drops obsolete §1 (delivered by #573/#765) and §2 (delivered by #768). Active scope:

- **§3** Tailscale Aperture / MagicDNS / HA / relay-vs-direct path detection.
- **§4** Cloudflare Workers AI 2026 free-tier catalog registration.
- **§5** Fleet-portability for users with different topologies.
- **§6 deferred**: IDE proxy carved into Epic #1020 (R&D #1021).

## §3 Tailscale Aperture analysis

### What Aperture provides (2026 beta)

- Centralized AI gateway running on Tailscale tailnet.
- Identity-based authentication (no API key distribution to clients).
- Routes to OpenAI, Anthropic, Google, etc. without changing client code.
- MagicDNS hostname resolution.
- Model-based routing + telemetry.
- MCP server proxying (single `/v1/mcp` endpoint that aggregates remote MCP servers).

### Aperture vs. LiteLLM (architectural choice)

| Dimension | Aperture | LiteLLM |
|---|---|---|
| Status | beta (alpha → beta in 2026) | v1.81.14 stable; SOC-2 Type 2 + ISO 27001 |
| Identity | Tailscale-native (auto) | API-key bearer per request |
| Routing | model-based + telemetry | declarative + retries + fallbacks; load-balancing |
| Observability | built-in dashboard | callback hooks (Lunary, MLflow, Langfuse) |
| Provider count | 4 known (OpenAI, Anthropic, Google, ?) | 100+ providers |
| MCP support | native (`/v1/mcp` aggregator) | not native; sidecar |
| Self-hosted | yes | yes |
| Cost | free with Tailscale plan | OSS + paid SaaS optional |

### Recommendation

**HYBRID** — keep LiteLLM as the multi-provider routing engine; layer Aperture as an optional Tailscale-native identity + MCP-aggregation layer. They are complementary, not substitutes:

- LiteLLM handles per-call routing across 100+ providers (existing investment; covers all our active providers).
- Aperture handles tailnet identity + MCP server proxying (HAMR `/mcp` could be aggregated by Aperture's `/v1/mcp` for cross-team visibility).

**Decision**: keep LiteLLM as primary routing engine. Aperture is **optional** and gated on a future child ticket once Tailscale plan permits and Aperture exits beta.

### MagicDNS + HA path detection

- **MagicDNS**: replace `inventory/devices.json` static IPs with MagicDNS hostnames (e.g., `36gbwinresource.tail-scale.ts.net`). Improves portability across operator devices.
- **Relay-vs-direct**: `tailscale netcheck` can detect relay use; expose via `scripts/global/fleet-config.js` so routing engine can prefer direct paths over relay.
- **HA**: when 36GB GPU offline, `fleet-config.js` falls back to penguin-1 / windows-laptop. Already partially implemented; needs explicit probe + cooldown.

## §4 Cloudflare Workers AI 2026 catalog registration

### Free tier (2026)

- 10,000 Neurons/day free.
- ~5,000–10,000 requests/day depending on model size.
- All hosted open models accessible.

### Models to register

| CF AI model ID | Class | Use case | Lane |
|---|---|---|---|
| `@cf/qwen/qwen3-30b-a3b-fp8` | code-capable, mid | fleet primary cloud | Free |
| `@cf/openai/gpt-oss-120b` | larger reasoning | fleet quality cloud | Free |
| `@cf/google/gemma-4-26b-a4b-it` | balanced | fleet fast cloud | Free |
| `@cf/ibm/granite-micro` | small fast | inline completions | Free |
| `@cf/meta/llama-3.1-...` | general (already known) | fallback | Free |

### Registration design

- Update `inventory/services.json` with CF AI section listing all free-tier models + Neuron costs.
- Update `inventory/ai-models.json` `cloudflare` section: list 5+ models with `mult: 0` (free) + `tier` ratings.
- Wire LiteLLM `litellm-config.yaml` named groups: `cloud-fleet-primary` → CF qwen3-30b, `cloud-fleet-quality` → gpt-oss-120b, `cloud-fleet-fast` → gemma-4-26b.
- Add `cf:` provider URL pattern to `scripts/global/fleet-config.js` resolver.
- Health-check probe: extend `scripts/global/substrate-health.js` to probe CF AI availability.

### Cost-aware routing

- CF AI free tier covers **most fleet-tier traffic** for typical operator. Once 10K Neurons/day is exhausted, spillover to Tailscale Ollama (also free, on-prem GPU).
- Premium spillover: when both CF AI and Tailscale Ollama unavailable, escalate to Anthropic Haiku (cheap-cloud per #587/#588).

## §5 Fleet-portability

### Problem

Current `inventory/devices.json` hardcodes Curtis's 4-node topology (`36gbwinresource`, `windows-laptop`, `penguin-1`, etc.). Other users adopting the harness get no guidance on adapting.

### Design

- **`scripts/global/fleet-discover.sh`** (NEW): scans Tailscale tailnet; produces a `devices.json` candidate per detected node with auto-detected hardware (GPU, RAM, OS).
- **`skills/fleet-portable-config/SKILL.md`** (NEW): walkthrough for adapting the policy to a different topology.
- **`inventory/devices.example.json`** (NEW): generic 2-node example (1 GPU, 1 CPU).
- **`scripts/global/fleet-config.js`**: refactor to consume devices.json with no hardcoded names; only capability tags (already shipped via #561).

### Migration

- `inventory/devices.json` stays as Curtis's specific topology.
- New users run `npm run hamr:fleet-discover` → produces `~/.megingjord/devices.json` overlaying.
- `fleet-config.js` reads operator overlay first, repo file second.

## Recommended child-ticket sketch

| # | Title | Effort | Owner | Dep |
|---|---|---|---|---|
| 1 | LiteLLM config: deployment ordering + latency routing + cooldowns | 1d | Claude Code | none (existing config evolution) |
| 2 | `inventory/services.json` + `ai-models.json` refresh: CF AI 2026 catalog | 0.5d | Claude Code | none |
| 3 | LiteLLM named groups: `cloud-fleet-{primary,quality,fast}` for CF AI | 0.5d | Claude Code | 2 |
| 4 | `fleet-config.js` MagicDNS resolution + relay-vs-direct probe | 1d | Claude Code | none |
| 5 | `substrate-health.js` extended: CF AI availability probe | 0.5d | Claude Code | 2, 3 |
| 6 | `fleet-discover.sh` + `devices.example.json` for portability | 1d | Claude Code | none |
| 7 | `skills/fleet-portable-config/SKILL.md` walkthrough | 0.5d | Claude Code | 6 |
| 8 | Aperture integration evaluation child (R&D-only; defer impl until beta exits) | 0.5d (R&D) | Claude Code | none |

**Total**: ~5.5 day-engineer. Children 1–7 independent; child 8 is research-only with no implementation cost.

## Acceptance criteria for implementation phase

### Per-child gates

- [ ] Each child cites this R&D doc.
- [ ] Each child honors strict-superset (existing routes unchanged when new resources unavailable).
- [ ] Each child includes tests (config validation, probe roundtrip, fallback verification).

### Epic-level acceptance

- [ ] Cloudflare AI free tier registered and consumable via LiteLLM named groups.
- [ ] `fleet-config.js` distinguishes direct vs. relayed Tailscale paths.
- [ ] `npm run hamr:fleet-discover` produces a usable per-operator devices overlay.
- [ ] Documentation: `skills/fleet-portable-config/SKILL.md` walkthrough.
- [ ] All scripts idempotent and fleet-portable.
- [ ] Aperture decision documented (kept LiteLLM as primary; Aperture deferred).

## Sources

- [Aperture by Tailscale docs](https://tailscale.com/docs/aperture)
- [Aperture AI Gateway](https://tailscale.com/use-cases/securing-ai)
- [Aperture configuration](https://tailscale.com/docs/aperture/configuration)
- [Aperture MCP server proxying](https://tailscale.com/docs/aperture/mcp-server)
- [Cloudflare Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- [Cloudflare Workers AI free-tier 2026](https://costbench.com/software/llm-api-providers/cloudflare-workers-ai/free-plan/)
- [LiteLLM proxy docs](https://docs.litellm.ai/docs/providers/litellm_proxy)
- [LiteLLM stable v1.81.14 + SOC-2](https://docs.litellm.ai/)
