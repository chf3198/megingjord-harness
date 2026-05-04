# Fleet Harness-Awareness — Centralized Governance / Wiki / Tools Server Research

Ticket: #861 (parent EPIC #860). Lane: docs-research. Date: 2026-05-04.

Goal: pick a free-tier substrate so every fleet model (Tailscale Ollama; Groq/Cerebras/OpenRouter/Google AI Studio) can fetch the harness's instructions/wiki/tools/identity on demand instead of the operator burning paid tokens to bundle context per call.

## Pattern catalogue

### 1. Cloudflare Workers + KV + R2

- **Workers free**: 100,000 requests/day, 10 ms CPU/request. ([Workers limits](https://developers.cloudflare.com/workers/platform/limits/))
- **Workers KV free**: 100,000 reads/day, 1,000 writes/day to different keys (1/s same key), 1 GB storage, 512 B keys, 25 MiB values, 1,000 namespaces. ([KV limits](https://developers.cloudflare.com/kv/platform/limits/))
- **R2 free**: 10 GB-month storage, 1M Class A ops/month, 10M Class B ops/month, **egress free** via Workers/S3/r2.dev. ([R2 pricing](https://developers.cloudflare.com/r2/pricing/))
- **Workers AI free**: 10,000 Neurons/day; `@cf/baai/bge-base-en-v1.5` costs 6058 Neurons/M tokens (~1.65 M tok/day free). ([Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/))

### 2. GitHub raw + Pages + Gist

- **Pages**: 1 GB published-site cap, 1 GB source-repo cap, **soft 100 GB/month bandwidth**, **soft 10 builds/hour**. Exceeding triggers a "polite email"; site may stop being served. ([Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits))
- **REST API**: 60/h unauthenticated, 5,000/h authenticated (15,000/h Enterprise Cloud). ([REST rate limits](https://docs.github.com/en/rest/overview/rate-limits-for-the-rest-api))
- **raw.githubusercontent.com**: per-IP rate-limited; 2025-05 update tightened the unauthenticated quota and now returns frequent 429s on `*.githubusercontent.com`. Recommended mitigation: authenticate. ([GitHub Changelog 2025-05-08](https://github.blog/changelog/2025-05-08-updated-rate-limits-for-unauthenticated-requests/))
- **Gist**: 1 MB per file (truncated above), 10 MB requires `git_pull_url`, 300 files/gist. No documented per-endpoint extra limit beyond REST. ([Gists API](https://docs.github.com/en/rest/gists/gists))

### 3. Anthropic Files API + prompt caching

- **Files API**: 500 MB/file, 500 GB/org, persists until deleted, free for upload/list/get/delete; rate-limited to ~100 req/min during beta; beta header `anthropic-beta: files-api-2025-04-14`. ([Files API](https://platform.claude.com/docs/en/docs/build-with-claude/files))
- **Prompt caching**: ephemeral 5-min (default, 1.25× write) or 1-hour (2× write); **cache reads cost 0.1× base input (90% savings)**. Up to 4 explicit `cache_control` breakpoints/request (auto uses 1). Min cacheable: 4096 tok (Opus 4.5–4.7, Haiku 4.5), 2048 (Sonnet 4.6, Haiku 3.5), 1024 (older Sonnet/Opus). **2026-02-05 change**: caches isolated per workspace on Claude API + Azure (not Bedrock/Vertex). ([Prompt caching](https://platform.claude.com/docs/en/docs/build-with-claude/prompt-caching))

### 4. MCP server hosting

- **Spec**: stdio (local) or **Streamable HTTP** (remote, OAuth/bearer/API key). One server, many clients. ([MCP architecture](https://modelcontextprotocol.io/docs/concepts/architecture))
- **Cloudflare-hosted MCP**: `workers-oauth-provider` (OAuth 2.1, tokens encrypted in KV); one-click deploy <2 min. ([CF MCP blog](https://blog.cloudflare.com/remote-model-context-protocol-servers-mcp/))
- **Smithery**: managed MCP marketplace; managed OAuth/credentials. Free-tier specifics not documented. ([Smithery docs](https://smithery.ai/docs))

### 5. Hugging Face Hub

- **Free user/org**: "best-effort" public; 100 GB private. Per-file <200 GB recommended, 500 GB hard cap; <100 k files/repo, <10 k/folder; CloudFront-served. ([HF storage limits](https://huggingface.co/docs/hub/storage-limits))

### 6. Vercel Blob + Netlify Blobs

- **Vercel Blob (Hobby)**: 5 GB storage, 100 K Simple Ops, 10 K Advanced Ops, 100 GB transfer included. Rate caps: 1,200/min simple, 900/min advanced. **Hobby locks the bucket for 30 days on overage rather than billing.** ([Vercel Blob pricing](https://vercel.com/docs/vercel-blob/usage-and-pricing))
- **Netlify Blobs**: 5 GB/object, 600 B keys, 2 KB metadata. Free-tier op/bandwidth quotas not in product docs. ([Netlify Blobs](https://docs.netlify.com/build/data-and-storage/netlify-blobs/))

### 7. Google Drive API

- **Quota**: 1 M units/min/project, 325 K/min/user, 400 M/day. Read=5, list=100, download=200. ACL: "Anyone with the link" gives unauth reads; not LLM-native. ([Drive API limits](https://developers.google.com/drive/api/guides/limits))

### 8. Litestream → S3/R2

- Continuous SQLite replication to S3/R2; v0.5.x **actively maintained** (2026). Read-replica via `litestream-vfs` (streams pages without disk restore). Multi-machine HA: use sibling **LiteFS**. ([Litestream alternatives](https://litestream.io/alternatives/))

## 2026-Q2 architectural patterns

- **Anthropic Skills (progressive disclosure)**: metadata always loaded (~100 tok), `SKILL.md` body loaded when triggered (<5 k tok), bundled resources read on-demand. API skills are workspace-scoped via `/v1/skills`; **Claude Code skills are filesystem-only and do not sync across surfaces**. ([Agent Skills](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview))
- **CLAUDE.md `@import`**: imports relative paths and `~/.claude/...` but **not** HTTP URLs. No native remote-rules mechanism. ([Claude Code best practices](https://code.claude.com/docs/en/best-practices))
- **Cursor / Continue.dev rules**: local `.cursor/rules` or `.continue/rules`. Continue Hub stores rules centrally but **"no automatic bidirectional sync"**; referenced via `uses: user/rule`. ([Continue rules](https://docs.continue.dev/customize/deep-dives/rules))
- **MCP central tool server**: one streamable-HTTP MCP server, many clients — canonical 2026 path. The **prompts primitive** is the "system-prompt-as-a-service" surface. ([MCP architecture](https://modelcontextprotocol.io/docs/concepts/architecture))
- **Prompt-caching for shared system prompts**: dominant production pattern. Stash the bundle in a `cache_control: ephemeral` block; first call writes (1.25×/2×), subsequent calls read at 0.1×. Post-2026-02-05 caches are workspace-scoped, so the entire team shares warm reads. ([Prompt caching](https://platform.claude.com/docs/en/docs/build-with-claude/prompt-caching))
- **Static prompt prefixes via CDN**: no documented production pattern; provider-side caching dominates. CDN-fetched prefixes help operator-side determinism but non-Anthropic fleets gain no caching unless the provider offers it.
- **Ollama `keep_alive`**: default 5 min; keeps the model loaded but does **not** persist system prompt — system prompt re-tokenizes per request. ([Ollama API](https://github.com/ollama/ollama/blob/main/docs/api.md))
- "Rules-as-a-Service" / "agent governance servers" is **not yet a standardized term** in 2026-Q2. Closest analogues: Continue Hub, Smithery, Anthropic Skills registry.

## Failure modes + identity

| Substrate | Down-mode | Fallback |
|---|---|---|
| CF Worker/KV/R2 | CF incident (rare) | #739 SQLite + last-good bundle |
| GitHub raw/Pages | 429 (now common); CDN faults | authenticated `gh api`; cached bundle |
| Anthropic Files API | region outage | inline content blocks |
| Hosted MCP | OAuth expiry, cold-start | local MCP (#784 mirror) |
| Hugging Face | CloudFront blip | mirrored `git clone` snapshot |
| Vercel/Netlify | Hobby lockout on overage | second free tier or R2 |
| Google Drive | per-user quota exhaust | API-key rotation + cached bundle |
| Litestream/LiteFS | S3 write outage | local SQLite WAL (#739) keeps serving |

**Identity / provenance.** Fleet models cannot sign output. Three production patterns:

1. **Edge-side signing**: server stamps the bundle with HMAC(`bundle_sha256 + agent_id + nonce + ts`); operator verifies on return — same model as Cloudflare's `workers-oauth-provider` re-issued tokens.
2. **Trailer attribution**: operator appends the `Team&Model` trailer **after** the fleet response (already canonical in `instructions/team-model-signing.instructions.md`). Fleet output carries no inherent trust; it's wrapped on return.
3. **Bundle hash as cache key**: `bundle_sha256 = sha256(canonical(instructions[]+wiki_hits[]+tool_catalog+identity))`. Same hash serves R2 ETag, Anthropic `cache_control` block, and the local #739 cache row.

**Stale-content drift.** Push: `post-merge` hook publishes to substrate. Pull: #788 probe re-runs every 24 h and tracks `bundle_age` alongside substrate health.

## Recommendation

**Winner: Cloudflare Worker + R2 (object body) + KV (small index/identity), with bundle hash as cache key, fronted by an MCP `prompts` + `resources` server.**

Rationale:

1. **Free-tier headroom**: 10 K reads/day × 50 KB = 500 MB/day = 15 GB/month, **inside R2's 10 GB-month + free egress** (egress is the moat vs Vercel/Netlify, both metered). Worker 10 K/100 K = 10× headroom; KV writes <<1 K/day cap.
2. **Latency**: Cloudflare POPs 20–40 ms RTT from US-East Tailscale exits; R2 reads stay on CF backbone. #739 SQLite absorbs intra-session repeats sub-ms.
3. **Cloud-fleet latency**: Groq/Cerebras/OpenRouter/Google all US-Central/East; bundle is a single text payload, p95 <100 ms.
4. **Install-agnostic**: anonymous public-Worker reads — no Cloudflare account required to consume; #788 probe gates write-side features.
5. **Composes with primitives**: #739 (local cache, returns 304 on SHA match), #740 (reuse same Worker/`wrangler` codebase), #788 (`cloudflare.worker.available` toggle), #784 (RAG MCP becomes a resource provider referenced by signed URL).

Runner-up: **GitHub Pages + raw**. Strictly free but the 2025-05 `*.githubusercontent.com` rate-limit tightening + 100 GB/mo soft cap make it brittle for primary 10 K/day; keep as fallback mirror.

Rejected: Vercel/Netlify Blobs (Hobby lockout on overage), Drive (not LLM-native, ACL-bound), HF datasets (best-effort, not transactional), Anthropic Files API alone (Anthropic-only — useless to Groq/Cerebras/OpenRouter/Ollama).

### Minimum-viable child scope

1. **Substrate**: Worker `harness-context-worker` + R2 bucket `megingjord-bundles` + KV namespace `megingjord-bundle-index` keyed by `<sha256>`. Endpoints: `GET /bundle/<sha256>`, `GET /bundle/latest?profile=<role>` → `{sha256, url}`.
2. **Bundler** (`scripts/global/harness-bundler.js`, ≤100 lines): canonicalize `(task_text, agent_identity, target_tier)` → `instructions[]+wiki_hits[]+tool_catalog+identity`; deterministic `sha256`; 30–60 KB JSON; pushed by `post-merge` hook.
3. **Cache key**: `bundle_sha256` — single value used as Anthropic `cache_control` key (1.25× write, 0.1× read), R2 ETag, and #739 row.
4. **Vendor wiring**:
   - Tailscale Ollama: pre-fetch via `cascade-dispatch.js`; inject as `system`; `keep_alive=30m` to amortize tokenization.
   - Groq/Cerebras/OpenRouter/Google AI Studio: prepend to request `system`; OpenRouter passthrough supports `cache_control`.
   - Anthropic direct: ephemeral `cache_control` block.
   - MCP surface: `prompts/get?name=harness&profile=...` + `resources/read?uri=harness://<sha>` for MCP-aware hosts.
5. **Fallback chain**: Worker → authenticated `gh api` raw mirror → #739 SQLite cache → embedded last-good bundle (gitignored, refreshed on `npm run setup`).
6. **Identity**: Worker stamps HMAC trailer (key in KV); operator verifies; canonical `Team&Model` trailer appended **after** fleet response.

Composes #739/#740/#784/#788 into a single context-as-a-service surface, stays inside every free tier with order-of-magnitude headroom, and gives non-Anthropic fleets a uniform "single fetch + inject" entry point.

## Sources cited

- [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Cloudflare KV limits](https://developers.cloudflare.com/kv/platform/limits/)
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [Cloudflare Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- [Cloudflare remote MCP servers blog](https://blog.cloudflare.com/remote-model-context-protocol-servers-mcp/)
- [Anthropic Files API](https://platform.claude.com/docs/en/docs/build-with-claude/files)
- [Anthropic prompt caching](https://platform.claude.com/docs/en/docs/build-with-claude/prompt-caching)
- [Anthropic Agent Skills overview](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)
- [Claude Code best practices (CLAUDE.md, skills)](https://code.claude.com/docs/en/best-practices)
- [MCP architecture](https://modelcontextprotocol.io/docs/concepts/architecture)
- [Smithery docs](https://smithery.ai/docs)
- [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
- [GitHub REST rate limits](https://docs.github.com/en/rest/overview/rate-limits-for-the-rest-api)
- [GitHub unauth rate-limit changelog 2025-05-08](https://github.blog/changelog/2025-05-08-updated-rate-limits-for-unauthenticated-requests/)
- [GitHub Gists API](https://docs.github.com/en/rest/gists/gists)
- [Vercel Blob pricing](https://vercel.com/docs/vercel-blob/usage-and-pricing)
- [Netlify Blobs](https://docs.netlify.com/build/data-and-storage/netlify-blobs/)
- [Hugging Face storage limits](https://huggingface.co/docs/hub/storage-limits)
- [Litestream alternatives / LiteFS](https://litestream.io/alternatives/)
- [Continue.dev rules](https://docs.continue.dev/customize/deep-dives/rules)
- [Google Drive API limits](https://developers.google.com/drive/api/guides/limits)
- [Ollama API (`keep_alive`)](https://github.com/ollama/ollama/blob/main/docs/api.md)
