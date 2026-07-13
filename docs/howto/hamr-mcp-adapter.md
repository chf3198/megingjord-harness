# HAMR MCP Adapter — How-To

**File**: `scripts/global/hamr-mcp-adapter.js`
**Ticket**: #3043 (Epic #3041 C1 — VS Code Copilot BYOK harness parity)
**Tier**: 2 (requires HAMR / Cloudflare Workers; degrades gracefully to Tier 0)

## What it does

Exposes five HAMR capabilities as MCP tools via a stdio MCP server, so VS Code
Copilot (BYOK mode) and any MCP-capable client can query governance state without
direct HAMR credentials. Each request is signed with an Ed25519 DPoP key
(`baton-signing.js` T4 ephemeral or T3 persisted via `OPERATOR_KEY_SEED_B64`).

| Tool | HAMR capability | Fallback |
|---|---|---|
| `governance_bundle_fetch` | `tool:governance-bundle` | local `governance-bundle.js` build |
| `review_run` | `review:run` | `{ ok: false, reason: 'hamr-disabled' }` |
| `bundle_fetch` | `bundle:fetch` | `{ ok: false, reason: 'hamr-disabled' }` |
| `quota` | `bundle:fetch` (cache-stats key) | `{ ok: false, reason: 'hamr-disabled' }` |
| `substrate_health` | `doctor:probe` | `{ ok: false, reason: 'hamr-disabled' }` |

## Tier-graceful degradation

`governance_bundle_fetch` never hard-fails. When HAMR is unreachable it reads
`~/.megingjord/governance-fields-<issue>.json` (written by `governance-bundle-push.js`)
and builds a local bundle with `source: 'local-fallback'`. All other tools return
`{ ok: false, reason: 'hamr-disabled' }` when `MEGINGJORD_HAMR_DISABLED=1`.

## Register in VS Code Copilot

Add to `.github/copilot-mcp.json` (or merge into the root `mcp.json`):

```json
{
  "servers": {
    "megingjord-hamr": {
      "type": "stdio",
      "command": "node",
      "args": ["scripts/global/hamr-mcp-adapter.js"],
      "env": {}
    }
  }
}
```

The server requires `@modelcontextprotocol/sdk` (already a dev-dependency via the
`xteam-mcp` server). No additional `npm install` step is needed in a repo with
linked `node_modules`.

## Environment variables

| Variable | Effect |
|---|---|
| `HAMR_URL` | Override HAMR Worker URL (default: `https://hamr.chf3198.workers.dev`) |
| `MEGINGJORD_HAMR_DISABLED=1` | Skip all HAMR calls; `governance_bundle_fetch` uses local fallback |
| `OPERATOR_KEY_SEED_B64` | 32-byte Ed25519 seed (base64) for T3 persistent DPoP key |

## Running tests

```bash
npx playwright test tests/hamr-mcp-adapter.spec.js
```
