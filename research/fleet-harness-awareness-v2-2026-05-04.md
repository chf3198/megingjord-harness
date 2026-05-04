# Fleet Harness-Awareness v2 — Agnostic Operation, Multi-Repo Identity, Redundancy, Native Caching, Inter-Team Comms

Ticket #863 (parent EPIC #860). Lane: docs-research. 2026-05-04. Supersedes (does not replace) v1 (`research/fleet-harness-awareness-2026-05-04.md`, #861).

v1's choice (CF Worker + R2 + KV + MCP, hash-keyed bundle, #739 SQLite fallback) **stands as the happy-path substrate**. v2 hardens six gaps.

## 1. Fleet-agnostic operation (degraded mode)

The harness must deliver instructions + wiki + identity with **zero fleet** and **no CF account**. Three-tier fallback:

**Tier A — npm-bundled snapshot.** Ship `dist/last-good-bundle.json` (~60 KB gzipped) inside the published tarball. `npm pack` includes the `files` manifest ([npm files](https://docs.npmjs.com/cli/v10/configuring-npm/package-json#files)); bundler runs in `prepack` ([npm scripts](https://docs.npmjs.com/cli/v10/using-npm/scripts#prepack)) so every published version carries a deterministic snapshot of `instructions/`, top wiki entities, and tool catalogue. Restore = one `fs.readFileSync`.

**Tier B — GitHub release-asset CDN.** Release assets serve from `github-production-release-asset-*.s3.amazonaws.com` outside the May-2025 `*.githubusercontent.com` rate-limit tightening ([changelog](https://github.blog/changelog/2025-05-08-updated-rate-limits-for-unauthenticated-requests/), [releases docs](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases)). Post-publish CI uploads `bundle-<sha>.json`; operator fetches `releases/download/v<x>/bundle-<sha>.json` — anonymous, unmetered.

**Tier C — runtime degraded mode.** Fleet AND bundle server AND release-asset all fail:
1. Load `dist/last-good-bundle.json`.
2. Stamp artifacts `harness_mode: degraded`, `bundle_age_days: <n>`.
3. Disable `cascade-dispatch.js --execute`; route to `claude-haiku-4-5` direct, or refuse offline.
4. Wiki ingest deferred to `~/.megingjord/queue/wiki-ingest-*.json`; replayed online.

**Minimum-viable footprint** (no fleet, no CF, no auth): `npx megingjord init` writes `.claude/`, `.github/instructions/`, `CLAUDE.md` from the snapshot; #739 SQLite holds session state; baton governance, ticket workflow, label-lint all run on filesystem + `gh` CLI.

v1 assumed the bundle server reachable. v2 makes the **embedded snapshot the floor**, server an accelerator — same shape as `tzdata` shipping with Node ([Node intl](https://nodejs.org/api/intl.html)).

## 2. Living Wiki — bidirectional evolution

Today only the operator runs `npm run wiki:ingest`. v2 adds async writeback with operator-mediated merge:

```
fleet ──[research]──> draft.json ──> R2://wiki-queue/<team>/<ts>-<sha>.json
                                            │
                  GitHub App webhook ──> PR vs megingjord
                                            │
                  operator (manager) reviews ──> merge ──> wiki:ingest --auto
```

- **R2 queue, not direct write.** Free tier 1M Class A ops/month ([R2 pricing](https://developers.cloudflare.com/r2/pricing/)) — ~33K writes/day headroom.
- **GitHub App delegated PRs.** Short-lived (1h) installation tokens ([GitHub Apps auth](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation)). Worker mints, opens PR `wiki/queue-ingest/<team>-<ts>`, no long-lived creds — canonical OAuth-Bot writeback.
- **Contribution identity.** Each entry signed by the team's MCP OAuth 2.1 token ([MCP auth](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization)). Worker validates `aud=megingjord-wiki-write`, stamps `Signed-by:` per `team-model-signing.instructions.md`, rejects unsigned (401).
- **MCP resources.** Queue exposed at `harness://wiki/queue/<team>/<id>` via `resources/list`+`resources/read`; 2025-06 draft adds subscriptions ([MCP resources](https://modelcontextprotocol.io/specification/2025-06-18/server/resources)).
- **Conflict resolution.** Different files: free CRDT merge (mostly append-only). Same file: **Yjs** Y.Text ([Yjs](https://docs.yjs.dev/api/shared-types/y.text)) on `wiki/sources/*.md`; convergence mathematically guaranteed ([Shapiro 2011](https://hal.inria.fr/inria-00609399v1/document)). Operator only sees pre-merged drafts.
- **Bidirectional pull.** Bundle server publishes `wiki-index.json` after each ingest. Fleet runtimes diff local hash on cold start; if stale, refetch top-N entities (LRU 32 pages × 4 KB = 128 KB).

v1 had wiki read-only from fleet. v2 makes it federated with operator as merge gatekeeper — inverse of "everyone is a committer".

## 3. Per-user multi-repo install — identity, restriction, security

One user × 5–10 repos. Identity binds to the **user**, not the **repo**.

**Bound JWT:**
- Issuer: CF Worker via `workers-oauth-provider` ([CF MCP blog](https://blog.cloudflare.com/remote-model-context-protocol-servers-mcp/)).
- Subject: `gh:<github-user-id>`, validated by GitHub OAuth device-flow at `npx megingjord login` ([device flow](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow)).
- Audience: `megingjord-bundle-read` or `megingjord-wiki-write`.
- Claim `installations[]`: each = `sha256(remote_origin_url + first_commit_sha)`. Enumerated at `npx megingjord install`.
- 24h TTL, refresh token in OS keychain via [node-keytar](https://github.com/atom/node-keytar). `~/.megingjord/identity.json` mode 0600.

**Worker access control:**
- All `bundle/*` require `Authorization: Bearer <jwt>`, validated via Cloudflare Access JWT verifier with JWKS cached in KV (24h) ([CF Access JWT](https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/)).
- Per-user rate cap (`usage:<gh-id>:<yyyy-mm-dd>`): 1000 reads/day; CF KV 100K/day ([KV limits](https://developers.cloudflare.com/kv/platform/limits/)) supports ~100 active users.
- Write endpoints additionally require `aud: megingjord-wiki-write` + GitHub `repo:write` scope.

**One wiki per user.** Mounted at `~/.megingjord/wiki/` (matches existing `~/.copilot/wiki/` pattern). Each repo install symlinks `.megingjord/wiki -> ~/.megingjord/wiki`. Cross-repo references resolve via `[[wikilinks]]`. Repo-specific knowledge stays in repo `docs/`.

**Cross-repo tool federation.** Tools register in `~/.megingjord/mcp.json`. Fleet model from `repoA` inherits user-scoped MCP union — including tools from `repoB` ([MCP tools](https://modelcontextprotocol.io/specification/2025-06-18/server/tools)). Name collisions resolve most-recently-installed (warn on `npm install`).

**Hybrid signing — sigstore + JWT.** Bundle signed by sigstore Cosign keyless ([sigstore](https://docs.sigstore.dev/cosign/keyless/)) — OIDC-bound to GitHub, no key management. JWT for low-latency Worker auth; Cosign sig verified once on `npm install`, cached. PASETO rejected: smaller ecosystem, no GitHub-OIDC binding.

v1 identity was per-bundle-hash HMAC. v2 binds to the person, scopes the substrate, federates state across N repos without re-auth.

## 4. Redundancy + failover including the bundle server

```
                 ┌─────────────────────────────────┐
                 │ Capability probe (#788) hourly  │
                 │ probes ALL substrates           │
                 └────────────────┬────────────────┘
                                  │ writes
                                  ▼
                  ~/.megingjord/substrate-health.json
                                  │ read by
                                  ▼
                       harness-bundler.js
                       (lowest-RTT first)
                                  │
        ┌────────┬───────────┬────┴────────┬──────────┐
        ▼        ▼           ▼             ▼          ▼
   [CF Worker] [GH Pages] [GH release  [r2.dev pub  [embedded
   R2+KV       mirror]    asset]       URL]         floor]
   p50 30ms    p50 80ms   p50 100ms    p50 50ms     p50 0ms
```

| Failure | Evidence | Mitigation |
|---|---|---|
| CF regional incident | [CF status history](https://www.cloudflarestatus.com/history), multiple SEV-1s 2024–25 | `health.json` switches to `gh-pages` mirror |
| R2 outage | CF status (separate) | Worker serves `kv.get('bundle-latest-mirror')` ≤25 MiB inline |
| KV consistency lag | up to 60s ([KV docs](https://developers.cloudflare.com/kv/concepts/how-kv-works/)) | `If-None-Match` ETag; fall through to R2 direct |
| Quota exhaust | writes 1000/day, reads 100K/day ([KV limits](https://developers.cloudflare.com/kv/platform/limits/)) | Per-user cap (§3); release-asset is unmetered |
| Embedded staleness | `bundle_age_days` always emitted | Dashboard surfaces drift; `npm update` refreshes |
| `*.githubusercontent.com` 429 | [2025-05-08 changelog](https://github.blog/changelog/2025-05-08-updated-rate-limits-for-unauthenticated-requests/) | `gh api` (auth) or release-asset (unmetered) |

**Detection without the substrate.** Probe runs from operator machine via cron; writes `substrate-health.json` locally. Probe targets are independent (CF / GitHub / HuggingFace / local file-stat). Operator health truth survives any single-substrate outage. Composes with #788.

v1 named the chain implicitly. v2 makes it data-driven, independently probed, embedded as never-broken backstop.

## 5. Per-fleet-resource native caching matrix

| Provider | Native caching | Min size | TTL | Cost benefit | Source |
|---|---|---|---|---|---|
| **Anthropic** | `cache_control: ephemeral` | 4096 tok (Opus/Haiku 4.5+); 1024–2048 older | 5 min default; 1 hr beta | write 1.25×/2×; **read 0.1×** | [Prompt caching](https://platform.claude.com/docs/en/docs/build-with-claude/prompt-caching) |
| **Ollama** baseline | `keep_alive` keeps weights; system prompt re-tokenizes | n/a | 5 min default; `-1` forever | tokenization saved, no cache | [Ollama API](https://github.com/ollama/ollama/blob/main/docs/api.md) |
| **Ollama 0.5.13+** | KV-cache via `OLLAMA_KV_CACHE_TYPE=q8_0` (opt-in) | full prefix match | per-session | re-tokenization avoided | [Ollama 0.5.13](https://github.com/ollama/ollama/releases/tag/v0.5.13) |
| **Groq** | None documented; >500 tok/s recompute | n/a | n/a | n/a | [Groq API](https://console.groq.com/docs/api-reference) — caching absent |
| **Cerebras** | None documented; wafer-scale recomputes | n/a | n/a | n/a | [Cerebras API](https://inference-docs.cerebras.ai/api-reference/chat-completions) |
| **OpenRouter** | Pass-through `cache_control` to upstream when supported (Anthropic/Gemini); ignored otherwise | per upstream | per upstream | per upstream | [OpenRouter caching](https://openrouter.ai/docs/features/prompt-caching) |
| **Gemini** | Explicit `cachedContents` resource | 4096 (2.5 Flash) / 32768 (1.5/2.0) tok | configurable, default 1h | read ~0.25× input + storage | [Gemini caching](https://ai.google.dev/gemini-api/docs/caching) |
| **vLLM** | Automatic prefix caching (`--enable-prefix-caching`); PagedAttention shares KV across requests | full prefix match | LRU at GPU mem | tokenization + KV recompute saved | [vLLM caching](https://docs.vllm.ai/en/latest/features/automatic_prefix_caching.html) |
| **llama.cpp** | `--prompt-cache <file>` + `--prompt-cache-all` persists KV | full prefix match | until file deleted | tokenization + KV-load saved | [llama.cpp server](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md) |

**Composition.** Bundler emits same canonical bytes; per-adapter wrap: Anthropic wraps in `cache_control: ephemeral`; Gemini PUTs once per `bundle_sha256` to `cachedContents`, cache-name at `~/.megingjord/cache-names/gemini-<sha>.txt`, 1h reuse; OpenRouter passes `cache_control` through (Anthropic/Gemini routes); Ollama uses prefix-stable system prompt + `keep_alive=30m` + optional `OLLAMA_KV_CACHE_TYPE=q8_0`; vLLM/llama.cpp self-host enable prefix caching in launcher; Groq/Cerebras have no caching — raw speed offsets it.

v1 treated caching as Anthropic-only. v2 spans 8 providers, names no-cache cases, gives per-adapter wrap rules.

## 6. Inter-fleet / inter-team communication

Teams (Claude Code, Copilot, Codex, Cursor, Continue, Aider) are isolated by default. v2 channel:

**Agent mailbox — MCP-resource-backed JSONL queue per team, hosted on the bundle server.**

```
R2://mailbox/<team>/inbox/<msg-id>.json    # writable by sender
R2://mailbox/<team>/outbox/<msg-id>.json   # readable by team's runtime
```

Envelope (subset of [Google A2A spec](https://google.github.io/A2A/), 2025-04 announcement):

```json
{
  "id": "msg_01H...", "ts": "2026-05-04T...Z",
  "from": {"team":"claude-code","model":"opus-4-7","alias":"<human>"},
  "to":   {"team":"copilot","capability":"code-review"},
  "task": "review-PR-#863",
  "context_uri": "harness://bundle/<sha>",
  "reply_to": "<msg-id>",
  "sig": "<cosign-bundle-signature>"
}
```

**Why A2A over MQTT/NATS.** A2A is HTTP+SSE — no broker, no persistent connection — fits the read-mostly invariant. MQTT/NATS need persistent brokers (~5MB+ RAM), exceed CF Worker envelope. A2A's `agent-card`/`tasks`/`messages`/`artifacts` map directly to MCP resources ([A2A repo](https://github.com/google/A2A)).

**Existing primitives.** Anthropic's [multi-agent research system](https://www.anthropic.com/news/built-multi-agent-research-system) (2025-06) + Microsoft [AutoGen 0.4](https://microsoft.github.io/autogen/0.4/) both use orchestrator + subagent + blackboard. v2 mailbox is on-disk realization with portable schema.

**MCP composition.** Mailbox surfaces as `tools/send_message(to, task, context_uri)` (write `inbox/`), `resources/read?uri=mailbox://outbox/<team>` (list pending), `prompts/get?name=respond-to-mailbox&msg=<id>` (wraps response with bundle context).

**Read-mostly preserved.** 1 PUT/message; 100 msgs/team/day × 6 teams = 18K/month — under 2% of R2's 1M Class A free cap. Lifecycle rules ([R2 lifecycle](https://developers.cloudflare.com/r2/buckets/object-lifecycles/)) auto-delete `inbox/*` after 7 days. KV is **not** used.

`mcp_agent_mail` (#740 reference) — confirmed not yet a published spec at 2026-Q2; v2 mailbox provides the equivalent natively.

v1 left inter-team unscoped. v2 picks A2A envelope + R2 JSONL + MCP exposure as the smallest deployable shape.

## Revised architecture diagram

```
                       ┌──────────────────────┐
                       │  USER (per-user JWT) │
                       │  ~/.megingjord/      │
                       │  identity.json       │
                       └──────────┬───────────┘
                                  │ aud-scoped
              ┌───────────────────┴───────────────────┐
              │                                       │
       ┌──────▼─────┐  Cosign-signed bundles  ┌───────▼────────┐
       │ CF Worker  │◄────────────────────────│ GitHub App     │
       │ bundle/    │                         │ delegated PRs  │
       │ wiki/      │                         │ (wiki merge)   │
       │ mailbox    │                         └────────┬───────┘
       └─┬───┬──────┘                                  │
         │   │                                         ▼
   ┌─────▼─┐ ┌▼──┐  ┌────────────┐  ┌──────────┐ megingjord
   │ R2    │ │KV │  │ Pages      │  │ release  │ repo (wiki
   │bndl/  │ │idx│  │ mirror     │  │ assets   │ source-of-
   │wiki/  │ │use│  │ (gh-pages) │  │ (CDN)    │ truth)
   │mbox   │ │   │  └────────────┘  └──────────┘
   └───────┘ └───┘
       ▲
       │
 ┌─────┴────────────────────────────────────────────┐
 │  FLEET RUNTIMES (per-provider cache adapter)     │
 │ ┌──────┐ ┌─────┐ ┌──────┐ ┌────┐ ┌────┐ ┌──────┐ │
 │ │Anthr.│ │Gem. │ │Ollama│ │Groq│ │Cerb│ │vLLM/ │ │
 │ │cache_│ │cach.│ │keep_ │ │ no │ │ no │ │llama │ │
 │ │ctrl  │ │Cont.│ │alive │ │cach│ │cach│ │.cpp  │ │
 │ └──────┘ └─────┘ └──────┘ └────┘ └────┘ └──────┘ │
 └──────────────────────────────────────────────────┘
       ▲                                    ▲
       │                                    │
 ┌─────┴──────────┐                  ┌──────┴────────┐
 │ EMBEDDED FLOOR │                  │ MAILBOX       │
 │ dist/last-good │                  │ R2 JSONL +    │
 │ -bundle.json   │                  │ A2A envelope  │
 │ (always)       │                  │ via MCP       │
 └────────────────┘                  └───────────────┘
```

## Updated decision matrix (delta vs v1)

| Decision | v1 | v2 | Why |
|---|---|---|---|
| Substrate | CF Worker+R2+KV | + embedded floor + release-asset mirror | "No CF account" path |
| Identity | HMAC bundle-hash | Per-user JWT + Cosign bundle sig | Multi-repo user-scoped auth |
| Wiki | Read-only | Bidirectional via R2 queue + App PR + Yjs | Living-wiki requirement |
| Failover | Implicit | `substrate-health.json` probe | Detection independent of substrate |
| Caching | Anthropic only | 8-provider matrix | Non-Anthropic was uncached |
| Inter-team | Out of scope | A2A + R2 JSONL + MCP mailbox | Explicit requirement |

## Revised MVP child ticket list

1. **#864 Embedded last-good floor** — `prepack` script, `dist/last-good-bundle.json`, runtime fallback chain.
2. **#865 Release-asset CDN mirror** — post-publish CI uploads `bundle-<sha>.json`; unmetered URL.
3. **#866 Bundle server (Worker + R2 + KV)** — v1 §5 plus per-user JWT. Composes with #739/#740/#788.
4. **#867 Per-user identity** — `npx megingjord login` device-flow, keytar refresh token, Worker JWT mint.
5. **#868 Provider caching adapters** — 8 adapters with observed read-cost-reduction tests.
6. **#869 Wiki bidirectional sync** — R2 queue + GitHub App + Yjs CRDT + `wiki:ingest --auto` driver.
7. **#870 Substrate health probe** — cron writes `substrate-health.json`; integrates #788.
8. **#871 Mailbox / inter-team comms** — A2A envelope, R2 JSONL, MCP send/read; 7-day eviction.
9. **#872 Cross-repo tool federation** — symlinked `~/.megingjord/wiki`, MCP server union, collision policy.

## Risk register (per failure mode)

| # | Risk | Mitigation | Residual |
|---|---|---|---|
| 1 | No internet on install | Tier-A embedded bundle | Stale by package version |
| 2 | Two teams ingest same source | Yjs CRDT + single-PR queue | Operator merge fatigue |
| 3 | JWT exfiltration | OS-keychain, 24h TTL, revoke endpoint | 24h compromise window |
| 4 | Total CF outage | Pages mirror + release asset + embedded | Embedded staleness |
| 5 | Provider deprecates caching | Adapter isolation; capability probe | Single-provider degradation |
| 6 | Mailbox spam | JWT aud-scope + KV rate cap + Cosign sig | 5-min replay — mitigate via nonce |

## What v1 got right (preserve)

CF Worker + R2 + KV substrate (economics, latency, headroom unchanged); bundle hash as cache key (shared by R2 ETag, Anthropic `cache_control`, #739 row); MCP `prompts`+`resources` as canonical surface; composition with #739 / #740 / #784 / #788.

## Sources cited (additions to v1)

- [npm `prepack`](https://docs.npmjs.com/cli/v10/using-npm/scripts#prepack) · [npm `files`](https://docs.npmjs.com/cli/v10/configuring-npm/package-json#files)
- [GitHub releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases) · [GitHub App auth](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation) · [OAuth device flow](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow)
- [MCP authorization](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization) · [MCP resources](https://modelcontextprotocol.io/specification/2025-06-18/server/resources) · [MCP tools](https://modelcontextprotocol.io/specification/2025-06-18/server/tools)
- [Yjs Y.Text](https://docs.yjs.dev/api/shared-types/y.text) · [Shapiro CRDT 2011](https://hal.inria.fr/inria-00609399v1/document)
- [sigstore Cosign](https://docs.sigstore.dev/cosign/keyless/) · [node-keytar](https://github.com/atom/node-keytar)
- [CF Access JWT](https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/) · [CF status history](https://www.cloudflarestatus.com/history) · [KV consistency](https://developers.cloudflare.com/kv/concepts/how-kv-works/) · [R2 lifecycle](https://developers.cloudflare.com/r2/buckets/object-lifecycles/)
- [Gemini caching](https://ai.google.dev/gemini-api/docs/caching) · [OpenRouter caching](https://openrouter.ai/docs/features/prompt-caching) · [vLLM prefix cache](https://docs.vllm.ai/en/latest/features/automatic_prefix_caching.html) · [llama.cpp server](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md) · [Ollama 0.5.13](https://github.com/ollama/ollama/releases/tag/v0.5.13) · [Groq API](https://console.groq.com/docs/api-reference) · [Cerebras API](https://inference-docs.cerebras.ai/api-reference/chat-completions)
- [Anthropic multi-agent system](https://www.anthropic.com/news/built-multi-agent-research-system) · [Microsoft AutoGen 0.4](https://microsoft.github.io/autogen/0.4/) · [Google A2A](https://google.github.io/A2A/) · [A2A GitHub](https://github.com/google/A2A)
