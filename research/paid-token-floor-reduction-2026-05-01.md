# Paid-Token Floor Reduction — Research & Design (2026-05-01)

**Epic:** #782
**Status:** Research complete, children created
**Lane:** docs-research

## Goal

Drive paid Claude Code / Copilot consumption below 50% of current volume by
moving the orchestration layer, repo-context loading, and per-turn state
out of the paid context window onto free fleet + free cloud resources.

## Three architectural moves (validated by 2026-Q2 research)

### Move 1 — Free-model orchestrator / decider

**Pattern (2026-Q2 production-converged):** **classifier + signal-extraction stack**, not "small LLM as router". The dominant production pattern uses tiny BERT-class classifiers (~110M params) with regex / keyword / embedding-similarity signals, falling back to a small LLM only on ambiguous edge cases. Reserves the premium model for load-bearing reasoning only.

**Reference projects:**

- **vLLM Semantic Router (Athena v0.2, March 2026)** — open-source Envoy `ext_proc` router with signal-extraction layer. Repo: <https://github.com/vllm-project/semantic-router>, vision paper: <https://developers.redhat.com/articles/2026/03/25/getting-started-vllm-semantic-router-athena-release>
- **RouteLLM (lm-sys)** — BERT classifier router; 85% cost reduction at 95% GPT-4 quality. Repo: <https://github.com/lm-sys/RouteLLM>, paper: <https://arxiv.org/pdf/2406.18665>
- **NVIDIA AI Blueprints `llm-router`** — Triton-deployed classifier reference. Repo: <https://github.com/NVIDIA-AI-Blueprints/llm-router>
- **RouterEval (EMNLP 2025)** — sub-1B classifiers match larger router LLMs at fraction of latency. Paper: <https://aclanthology.org/2025.findings-emnlp.208.pdf>

**Latency budget evidence:**
- Groq Llama-3.1-8B: ~640 tok/s, ~110-160 ms TTFT — well within one cache-hit boundary
- ClawRouter sub-1ms in-process routing
- Opper benchmark: OpenRouter 0.640s vs OpenAI direct 0.712s — routing overhead negligible

**Design for Megingjord:**
- Port vLLM-SR signal-extraction layer to a Cloudflare Worker (free, edge-fast)
- Fall back to Groq Llama-3.3-70b for ambiguous cases
- Cache routing decisions per-task-fingerprint (hash of task description + capability matrix) in Cloudflare KV — repeat decisions return in <10 ms

### Move 2 — Repo-context RAG via penguin-1

**Pattern (2026-Q2 production-converged):** **MCP server exposing `search_repo` tool**, with AST-aware chunking + reranking. Anthropic's "Effective Context Engineering" (Sep 2025) formalized this as **"just-in-time context"** — agents hold lightweight identifiers and load via tool calls at runtime, not eager-stuff CLAUDE.md.

**Reference projects:**

- **`zilliztech/claude-context`** — best fit for our pattern. MCP server exposing `search_code` to Claude Code; pluggable embedders (Ollama, Voyage, Gemini, OpenAI); Milvus/Zilliz vector DB; AST splitter for 14+ languages. Repo: <https://github.com/zilliztech/claude-context>
- **VS Code 1.114 (April 2026) `#codebase`** is now purely semantic — removed fuzzy fallback. Doc: <https://code.visualstudio.com/docs/copilot/reference/workspace-context>
- **Continue.dev `@codebase`** — voyage-code-3 (cloud) or nomic-embed-text (local Ollama) + separate reranker. Doc: <https://docs.continue.dev/customize/model-roles/embeddings>
- **Cursor @codebase** — Turbopuffer + AST chunking + proprietary embedder. Blog: <https://cursor.com/blog/secure-codebase-indexing>
- **Aider repo-map** — *no embeddings*; NetworkX PageRank over Tree-sitter symbol graph. Alternative path. Doc: <https://aider.chat/docs/repomap.html>
- **Sourcegraph Cody (2026)** — *retired embeddings*; uses Zoekt + SCIP. Architectural argument: at monorepo scale, structural search wins. Blog: <https://sourcegraph.com/blog/lessons-from-building-ai-coding-assistants-context-retrieval-and-evaluation>
- **Anthropic guidance** — context-engineering: <https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents>

**Design for Megingjord:**
- Stand up a `claude-context`-style MCP server on **penguin-1** (already has `nomic-embed-text` + `snowflake-arctic-embed:m` installed)
- Tree-sitter AST chunking before embedding
- Vector store: **Cloudflare Vectorize free tier** (30M dims queried + 5M stored, free) — keeps the index off the memory-tight LXC
- Reranker: FlashRank lite (~100 MB) on penguin-1
- MCP tool: `search_repo(query, k=5)` returns top-k snippets; agents call instead of `Read`

### Move 3 — Per-turn state offload to free MCP

**Pattern:** state that is RARELY needed but ALWAYS in context (baton state, branch pointer, recent activity, agent identity) lives in a free MCP tool surface; agents fetch on-demand.

**Substrate decision: Cloudflare Workers + Durable Objects + KV** (already greenfield from #740). Free tier:
- DO: 1M req/mo (on $5/mo Paid plan; or use KV-only on Free)
- KV: 100k reads + 1k writes/day FREE
- D1 SQLite: 5M rows read + 100k written/day FREE
- Vectorize: free tier matches Move 2 needs

**Design for Megingjord:**
- Re-purpose the Cloudflare Worker stub from #740 (PR #748)
- Expose MCP tools: `get_baton_state(issue_n)`, `get_branch_pointer(repo)`, `get_recent_activity(since)`, `get_assignee(issue_n)`
- Coordinate identity with #737's assignee-guard
- Eviction tradeoff: only offload state ≤500 tokens per fetch with <100 ms latency budget; anything larger or hotter stays in-context

## The lowest-hanging fruit (a fourth move not in the original plan)

### Move 0 (highest ROI, zero risk) — Cloudflare AI Gateway in front of Anthropic

Cache caching in front of any LLM API. Free tier covers our entire current volume with room to spare. **30-60% cache hit rate observed in production agent harnesses** (Cloudflare blog Q4 2025).

- Free
- 5-20 ms added latency
- Zero application code change — just point `ANTHROPIC_BASE_URL` at the gateway
- Independent of Move 1/2/3; **ship this first**

Doc: <https://developers.cloudflare.com/ai-gateway/>

## Free-cloud services matrix (verified 2026-Q2 unless flagged)

| Provider | Service | Free quota | Best fit |
|---|---|---|---|
| **Cloudflare** | AI Gateway | unlimited free, just pay upstream | Cache Anthropic — Move 0 |
| Cloudflare | Workers + DO + KV + D1 | 100k req/day Workers; KV 100k reads/day; D1 5M reads/day | Move 1 router host, Move 3 state |
| Cloudflare | Workers AI | 10k Neurons/day; Llama 3.1 8B, 3.2 1B/3B, `@cf/baai/bge-base-en-v1.5` (free embeddings) | Move 1 router-LLM fallback, Move 2 embeddings |
| Cloudflare | Vectorize | 30M dims queried + 5M stored | Move 2 RAG vector store |
| **Google AI Studio** | Gemini 2.0 Flash | 15 RPM, 1M tokens/day, **no card required** | Move 1 ambiguous-case fallback |
| Google AI Studio | embedding-004 | 1500 req/day | Move 2 embeddings (alt to Workers AI bge) |
| **GitHub Models** | inference (incl. Claude 3.5 Sonnet, GPT-4o, Llama 405B) | rate-limited per Copilot tier | Move 1 premium fallback at zero cost |
| **Modal** | compute | $30/mo recurring free | Move 2 RAG indexing batch jobs |
| **Supabase** | pgvector | 500 MB Postgres + 5 GB bandwidth | Move 2 RAG store (alt to Vectorize) |
| **Upstash** | Vector + Redis | 10k vectors free; 10k Redis cmd/day | Move 3 state (alt to KV) |
| **Turso** | libSQL | 9 GB free | Move 3 state (alt to D1) |
| Hugging Face | Inference API | ~300 req/hr serverless | Move 2 embeddings fallback |
| Vercel | Functions + Edge Config | 100GB-hr, 1M edge-fn/mo | Move 1 host alt |
| AWS | Lambda | 1M req + 400k GB-s/mo always-free | Cron / glue |
| Google Cloud | Cloud Run | 2M req/mo + 360k vCPU-s | Long-running orchestration alt |
| Mistral | La Plateforme | rate-limited free tier (verify) | Move 1 fallback |

Skip: **Fly.io** (no free tier), **Replicate / Fireworks / Together / DeepInfra** (one-shot trial credits only), **AWS Bedrock** (12-mo trial only), **RunPod / Lambda Labs** (no free tier).

### Multi-account stacking — explicitly rejected

All major providers' 2026 ToS forbid quota-stacking via multiple accounts. Cloudflare actively detects and rate-floor or suspends. **Recommended pattern: single-account multi-vendor**, where each provider sees one fair-use tenant.

## Combined estimated paid-token reduction

Based on the cost-share breakdown (orchestration 30-50%, premium-only 15-25%, context tax 20-35%, observability 5-10%):

| Move | Est. reduction of CURRENT paid spend | Risk |
|---|---|---|
| 0 (AI Gateway cache) | **15-25%** | Trivial — just env var change |
| 1 (free orchestrator) | **15-25%** | Medium — routing accuracy must be measured |
| 2 (repo-context RAG) | **15-25%** | Medium — retrieval quality risk |
| 3 (state offload) | **5-10%** | Low — surface narrow |

**Combined target if all four ship: 50-75% reduction in paid Claude/Copilot tokens** at constant capability. The remaining ~25-50% is irreducible without replacing the harness itself (premium-only multi-hop reasoning + UAT dialog).

## Phased implementation plan (children spawned)

| Phase | Child ticket | Move | Why first |
|---|---|---|---|
| 1 | (created below) | Move 0 — AI Gateway | Zero risk, immediate savings, unblocks measurement of moves 1-3 |
| 2 | (created below) | Move 2 — Repo RAG MCP | Highest ROI per dev-day; reuses penguin-1 already provisioned |
| 3 | (created below) | Move 3 — State offload MCP | Reuses #740 Cloudflare Worker substrate |
| 4 | (created below) | Move 1 — Free orchestrator | Highest complexity; needs accuracy benchmarking |

## Constraints honored

- All four moves preserve the install-environment-agnostic property: each is opt-in and falls back to direct Anthropic calls if its substrate is unconfigured
- Single-account multi-vendor only (no ToS-violating quota stacking)
- Coordination with #781 (parallel queue) — Move 1 emits queue-aware decisions
- Coordination with #737 (assignee guard) — Move 3 reuses agent-identity primitive

## Sources (full citation list)

Same URLs as inline citations above. Wiki ingest queued at `wiki/sources/paid-token-floor-reduction-2026-05-01.md`.
