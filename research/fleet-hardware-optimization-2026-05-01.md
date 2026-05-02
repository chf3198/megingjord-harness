# Fleet Hardware Optimization — Research & Design (2026-05-01)

**Epic:** #734 (P2)
**Implementation companion:** #765
**Maintenance companion:** #766
**Lane:** docs-research

## Vision

Maximize coding-task quality and throughput on each fleet host while keeping
the harness install-environment-agnostic — every recommendation must work on
any host of equivalent hardware tier, not just the specific machines owned
by this operator.

## Three workstreams

### Workstream 1 — 36gbwinresource (4 GB VRAM, NVIDIA Quadro T2000)

Current: `qwen2.5-coder:7b` Q4_K_M, ~22 tok/s warm (regressed from 32.3
baseline due to idle eviction).

**Candidate matrix** (Groq llama-3.3-70b-versatile, 2026-05-01):

| Model | Quant | VRAM | Quality vs baseline | Install | Replicability /10 |
|---|---|---|---|---|---|
| **Qwen3-coder 4B** (Apr 2026) | FP16 | ~2.5 GB | +15% | medium | 8 |
| qwen2.5-coder:7b IQ3/Q3 | INT8 | ~1.8 GB | +5% | low | 9 |
| qwen2.5-coder:3b | FP16 | ~1.2 GB | -10% | low | 9 |
| starcoder2:3b | FP16 | ~1.5 GB | -5% | medium | 7 |
| granite-code:3b | INT8 | ~1.8 GB | -15% | medium | 8 |
| deepseek-coder 1.3B | FP16 | ~2.2 GB | +10% | high | 6 |
| deepseek-coder 6.7B IQ3 | INT8 | ~3.5 GB | +20% | high | 5 |

**Recommendation**: primary = **Qwen3-coder 4B** (best quality-to-VRAM ratio
in 2026-Q2); fallback = **qwen2.5-coder:7b at IQ3/Q3** with `num_ctx=2048`
for KV headroom. Both pinned in the install script so any 4 GB-VRAM card
can replicate.

### Workstream 2 — OpenClaw (16 GB CPU only Windows)

Current: Ollama with `qwen2.5-coder:7b` Q4, ~3.7 tok/s warm (regressed from
7.3 baseline due to idle eviction). LiteLLM gateway port 4000 currently DOWN.

**Engine matrix** (Groq llama-3.3-70b-versatile, 2026-05-01):

| Path | Expected warm tok/s | Install | Routing impact | Replicability /10 |
|---|---|---|---|---|
| Ollama + `OLLAMA_KEEP_ALIVE=24h` | 7.3 | low | none | 8 |
| **llamafile single-binary** | 11.0 (+50%) | medium | OpenAI-compat endpoint update | 9 |
| Raw llama.cpp server | 10.5 | high | custom routing | 6 |
| llamafile + Ollama side-by-side | 11.0 | medium | Ollama orchestrates | 9 |

**Recommendation**: switch to **llamafile single-binary** running
qwen2.5-coder:7b Q4_K_M with `--mlock` and `-t <physical-cores>`. Same
model, ~50% CPU speedup per Justine Tunney's matmul work. Keep OpenClaw
aggregator role as a routing endpoint (the OpenAI-compatible API surface
stays unchanged from a routing perspective).

LiteLLM port-4000 disposition: deferred to #765 implementation epic — fix
the gateway OR remove the dispatcher's reference. Current state breaks
`npm run wiki:ingest`.

### Workstream 3 — penguin-1 (~880 MB free RAM, ChromeOS Linux LXC)

Currently has `qwen3.5:0.8b` and `gemma3:270m` installed but rarely routed.
Always-on, Tailscale-meshed, idle.

**Utility matrix** (Groq llama-3.3-70b-versatile, 2026-05-01):

| Pattern | Token reduction | RAM | Install | Replicability /10 |
|---|---|---|---|---|
| MiniLM-L6-v2 embedder | 30–50% | ~80 MB FP32 / 43 MB FP16 | medium | 8 |
| FlashRank lite reranker | 10–20% | <100 MB | low | 9 |
| Hybrid BM25 + MiniLM | 40–60% | ~150 MB | high | 7 |
| **Tool-runner sandbox** | 5–10% | ~50 MB | medium | 9 |
| Doc pre-processor (gemma3:270m) | 20–30% | ~200 MB | high | 6 |

**Phased recommendation**:
1. **Tool-runner sandbox** first — lowest RAM cost, highest replicability,
   sets the foundation pattern (MCP-server-on-fleet)
2. **MiniLM-L6-v2 embedder** second — biggest token-reduction lift per MB
3. **FlashRank reranker** third — multiplies the embedder's value

Hybrid BM25 + MiniLM and the Doc pre-processor are deferred — the install
complexity does not justify the RAM cost for an always-on tier.

## Independent second opinion (Cerebras llama3.1-8b)

- **Agree** with all three primary recommendations (Qwen3-coder 4B,
  llamafile, phased tool-runner→embedder→reranker).
- **Challenge**: 4 GB VRAM may bottleneck on complex computations — flag a
  per-task complexity guard so the harness escalates to cloud when local
  inference would be too slow.
- **Risk**: penguin-1 sequential install could hit resource exhaustion;
  install-time RAM probe before each phase, fall back gracefully.

## Replicability constraint check

- **36gbwinresource**: recommendations apply to any 4 GB VRAM card (Quadro
  T2000, RTX 3050 4GB, P620, A2000 4GB) — pure VRAM-tier targeting, not
  vendor-specific. ✅
- **OpenClaw**: llamafile is cross-platform (Windows / Linux / macOS via
  AVX2/AVX512 auto-dispatch). Works on any 16 GB CPU host. ✅
- **penguin-1**: sub-1 GB Linux applies to Pi 4/5, NUC, Chromebook LXC,
  any container with the same RAM ceiling. ✅

## Phased adoption order

| Phase | Action | Owner |
|---|---|---|
| 1 | Restore baselines: `OLLAMA_KEEP_ALIVE=24h` on both Windows hosts | #765 implementation |
| 2 | Reconcile `inventory/devices.json` to live `/api/tags` | #765 |
| 3 | 36gbwinresource: install Qwen3-coder 4B, benchmark, set as primary | #765 |
| 4 | OpenClaw: install llamafile, switch primary endpoint, benchmark | #765 |
| 5 | penguin-1: ship tool-runner sandbox MCP server | follow-up child of #765 |
| 6 | penguin-1: add MiniLM embedder, FlashRank reranker | follow-up child |

## Out of scope

- Hardware purchases.
- Replacing the existing fleet topology.
- The ongoing maintenance loop (research in #766).

## Sources

- 2026-05-01 fleet audit: `wiki/sources/fleet-resource-audit-2026-05-01.md`
- Justine Tunney matmul work — llama.cpp CPU speedup
- MiniLM-L6-v2 sentence-transformers model card
- FlashRank lite reranker
- Karpathy LLM Wiki v2 (typed relationships, decay-based trust)
- Live Groq dispatch outputs preserved at \`/tmp/ws{1,2,3}.md\` during research

## Fleet utilization for this research

- Workstream 1 (4 GB VRAM matrix): **Groq llama-3.3-70b-versatile** (free)
- Workstream 2 (CPU engine paths): **Groq llama-3.3-70b-versatile** (free)
- Workstream 3 (SLM utility patterns): **Groq llama-3.3-70b-versatile** (free)
- Independent second opinion: **Cerebras llama3.1-8b** (free)
- OpenClaw on-fleet attempted but slow on CPU; Cerebras provided second opinion instead
- Synthesis: deterministic local assembly, zero LLM tokens
