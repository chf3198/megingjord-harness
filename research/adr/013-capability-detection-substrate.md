---
title: "ADR-013: Capability Detection Substrate for Optional Cost-Reduction Features"
status: Accepted
date: 2026-05-01
related: [#788, #782, #783, #784, #785, #786]
---

# ADR-013: Capability Detection Substrate

## Context

Epic #782 introduces four opt-in token-cost-reduction features (Tier 0-3)
that each depend on a different substrate (Cloudflare account, Tailscale
fleet, free LLM provider keys, MCP RAG server). The harness must remain
**install-anywhere**: a fresh clone with no fleet and no Cloudflare account
must still satisfy the three primary purposes (governance, wiki,
fleet-config).

Without a unified detection layer, each feature would re-implement
substrate probing, leading to drift, duplicate probe traffic, and
inconsistent fallback behavior.

## Decision

Ship a **single capability probe + manifest substrate** that:

1. Detects available substrates via read-only network/exec probes
2. Records results in `.dashboard/capabilities.json` (gitignored, per-install)
3. Is consumed by every Tier 0-3 feature to gate activation

**Manifest schema (v1)**:

```json
{
  "probed_at": "<ISO8601>",
  "schema_version": 1,
  "tailscale": { "available": bool },
  "fleet": { "<host_id>": { "reachable": bool, "models": [string] } },
  "cloudflare": { "account": { "available": bool } },
  "providers": {
    "<id>": { "available": bool, "http_status": int, "reason": string? }
  },
  "mcp": { "rag_server": { "reachable": bool, "url": string } }
}
```

**Provider IDs probed (v1)**: `anthropic`, `openai`, `groq`, `cerebras`,
`google_ai_studio`, `openrouter`. Each probed via metadata endpoint
(`/v1/models` or equivalent) — no inference, no token charges.

**Read-only invariant**: probe never charges tokens, never creates accounts,
never mutates user state.

## Consequences

**Positive:**
- Single source of truth for "what's available right now"
- Each Tier 0-3 feature reads the manifest, lights up only when its substrate is present
- Forward-compatible: adding new providers = appending to `PROVIDER_PROBES` array
- Probe completes in <10s on healthy install (Promise.allSettled parallelization)
- No-substrate fresh clones get a clean install — banners show what's off

**Negative:**
- Manifest can go stale (mitigation: `probed_at` age check; banner suggests re-probe at >24h)
- Probe tells us "auth works" but not "quota fine" (e.g. OpenAI insufficient_quota or OpenRouter $0 cap shows `available: true`); quota-fitness is downstream concern
- Adding a substrate that requires authentication state (e.g. OAuth flow) requires a separate setup ritual outside the probe

## Alternatives considered

- **Per-feature probing**: rejected — drift + duplicate traffic
- **Always-call-substrate-on-use**: rejected — slow, charges tokens for `available?` checks
- **Static config file**: rejected — out-of-date the moment user adds a key
- **Probe inference endpoints**: rejected — would charge tokens for capability detection
- **Single keyed health-check call per provider**: rejected for v1 — too noisy for read-only-by-design probe; quota detection deferred to a future health-check pass

## Verification

- `tests/capability-probe.spec.js` — 6 Playwright tests covering schema, read-only, missing-binary fallback, missing-key fallback, show CLI, tier-availability mapping
- Manual probe on three install scenarios (no-substrate, full-substrate, mixed)
- Each Tier 0-3 child PR demonstrates manifest-read on init and graceful no-op when its fields are missing

## Related

- ADR-007 LLM Wiki Knowledge System Adoption
- ADR-012 Multi-Agent Worktree Path Governance
- Epic #782 — paid token floor reduction
- Children: #783 (Tier 0), #784 (Tier 2), #785 (Tier 3), #786 (Tier 1)
