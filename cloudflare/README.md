# Megingjord — Layer 3 Cloudflare Worker Coordination

Optional cloud coordination for the multi-agent command center
(#736 / #740). Free to run inside Cloudflare's free tier (100k
requests/day, 1 GB Durable Object storage).

## Files

- `worker.ts` — Worker entry; routes to a per-fleet Durable Object
- `durable-object.ts` — Coordinator DO: lease + heartbeat APIs
- `wrangler.toml` — Deploy config

API surface mirrors `scripts/global/agent-coord-local.js` (Layer 4
fallback). Client at `scripts/global/agent-coord-remote.js` switches
between local SQLite and remote Worker based on `CLOUDFLARE_WORKER_URL`.

## Deploy

```bash
npm install -g wrangler
cd cloudflare
wrangler login
wrangler deploy
```

`wrangler deploy` outputs the worker URL (e.g.
`https://megingjord-coord.<your-subdomain>.workers.dev`).
Set it in the project `.env`:

```
CLOUDFLARE_WORKER_URL=https://megingjord-coord.<your-subdomain>.workers.dev
```

When `CLOUDFLARE_WORKER_URL` is unset (default), the harness uses
Layer 4 local SQLite only and shows a "limited mode" banner. No
Cloudflare account is required to use Megingjord.

## Endpoints

- `GET /healthz` — basic liveness
- `POST /lease/acquire?fleet=<id>` body `{key, ttlSec, agentId}`
- `POST /lease/release?fleet=<id>` body `{key, agentId}`
- `POST /heartbeat?fleet=<id>` body `{agentId}`
- `GET /agents?fleet=<id>&maxAgeSec=<n>`

`fleet` is the per-org/per-team identifier (default `default`); each
fleet maps to its own Durable Object instance.

## Future work

Full `mcp_agent_mail`-compatible FastMCP transport (TTL advisory
file leases, agent inbox, threads) is deferred to a follow-up child
of #736 once usage justifies it. This PR ships the coordination
substrate (lease + heartbeat) which is sufficient for the failure
classes #736 was scoped to address.

## Pin

`mcp_agent_mail` reference (when integrated):
- Repo: `https://github.com/Dicklesworthstone/mcp_agent_mail`
- SHA: pin at integration time

## Cost

Free tier: 100k requests/day, 1 GB DO storage. Megingjord's
expected baton-transition rate is ~5-50/day per active operator.
Headroom is ~1000×.
