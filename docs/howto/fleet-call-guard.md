# fleet-call-guard.js — Usage Guide

> **When to use**: for ad-hoc fleet model calls that do NOT go through
> `cascade-dispatch.js`. If routing through the harness, cascade-dispatch is
> preferred. Use this guard when calling a fleet model directly (scripts, test
> harness, one-off analysis).

## CLI Usage

```sh
node scripts/global/fleet-call-guard.js \
  --model qwen2.5-coder:7b \
  --host http://100.91.113.16:11434 \
  --prompt "rate this code 1-10" \
  --timeout 30000 \
  --max-retries 2
```

Exit codes:

| Code | Meaning | stdout |
|------|---------|--------|
| `0` | Success | `{"success":true,"response":"...","model":"...","elapsed_ms":N}` |
| `1` | Timeout | `{"success":false,"reason":"timeout","elapsed_ms":N,"host":"...","fallback_tier":"free-cloud"}` |
| `1` | Retry exhaustion | `{"success":false,"reason":"retry_exhaustion","attempts":N,"fallback_tier":"free-cloud"}` |
| `2` | Unexpected error | stderr message |

## Programmatic API

```js
const { callWithGuard } = require('./scripts/global/fleet-call-guard.js');

const result = await callWithGuard({
  model: 'qwen2.5-coder:7b',       // Ollama model name
  host: 'http://100.91.113.16:11434', // fleet host URL
  prompt: 'Review this function...',
  timeout: 45000,   // ms before a single attempt times out (default: 45000)
  maxRetries: 2,    // retries after failure (default: 2; 0 = no retries)
});

if (!result.success) {
  // G6 contract: guard signals; caller routes.
  routeTo(result.fallback_tier); // 'free-cloud'
}
```

## G6 Caller Contract

`fleet-call-guard.js` is a **signal emitter** — it does NOT auto-route to the
fallback tier. On failure it returns `fallback_tier: 'free-cloud'`. The caller
must act on that signal (e.g. call free-cloud-dispatch.js, openrouter-free, etc).

On timeout, the guard also appends to `~/.megingjord/incidents.jsonl` with
`pattern_id: 'fleet-call-timeout'` for Tier-1 observability.

## Escape Hatch (G5 portability)

```sh
FLEET_GUARD_DISABLED=1 node scripts/global/fleet-call-guard.js ...
```

Bypasses timeout enforcement. Use for air-gapped operators where fleet is absent
at baseline (G5), or during integration testing that does not need the guard.

## guard vs. cascade-dispatch.js

| | fleet-call-guard.js | cascade-dispatch.js |
|---|---|---|
| Use for | Ad-hoc, direct calls | All routine routing |
| Timeout | 45s default, configurable | Built-in via AbortController |
| Fallback | Caller-routed (signal) | Automatic (built into cascade) |
| Retries | Yes, configurable | Via cascade retry logic |

## Security Note (G4)

Fleet hosts are on Tailscale VPN (private network, 100.x.x.x). stdout contains
only model response and metadata — no credentials. Never log prompt contents
containing secrets.
