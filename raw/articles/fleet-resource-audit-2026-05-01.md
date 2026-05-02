# Fleet Resource Audit — 2026-05-01

## Tailscale mesh

Four nodes, all `active` and direct-routed (no relay):

| Node | Tailscale IP | OS | RTT | Notes |
|---|---|---|---|---|
| penguin (this dev) | 100.87.216.75 | Linux | self | Primary dev |
| 36gbwinresource | 100.91.113.16 | Windows 10 Pro | 11 ms | GPU Quadro T2000 4GB VRAM |
| desktop-909a7km / OpenClaw | 100.78.22.13 | Windows | 9 ms | CPU only, 16 GB RAM |
| penguin-1 | 100.86.248.35 | Linux LXC | 326 ms | Off-network mobile, sub-2B models |

## Ollama endpoint health

All three Ollama nodes responded HTTP 200 on `/api/tags`. Cold-load + 2-token warm benchmarks:

| Node | Cold-load | Warm TPS | Available models (live) |
|---|---|---|---|
| 36gbwinresource | 2.92 s | 22.0 tok/s (qwen2.5-coder:7b) | qwen2.5-coder:7b only |
| OpenClaw | 8.34 s | 3.7 tok/s (qwen2.5:7b-instruct) | qwen2.5:7b-instruct, qwen2.5-coder:7b |
| penguin-1 | n/a | n/a | qwen3.5:0.8b, gemma3:270m |

Drift vs `inventory/devices.json`: 9 models listed are NOT installed (phi3:mini, mistral-nemo, llama3.1:8b, phi3:medium, mistral, tinyllama, lfm2.5-thinking:1.2b, plus 36gbwinresource missing 2 of 3). Routing to any uninstalled model fails at dispatch.

Performance regressions vs inventory baseline:
- 36gbwinresource: inventory says 32.3 tok/s warm, measured 22.0 (32% slower)
- OpenClaw: inventory says 7.3 tok/s warm, measured 3.7 (49% slower)

Likely cause: `OLLAMA_KEEP_ALIVE` not set; default 1-min idle eviction forces re-load on every burst.

## Cloud provider state

| Provider | Auth | Smoke | Issue |
|---|---|---|---|
| Anthropic | ✅ | ✅ ok | None |
| OpenAI | valid key | ❌ insufficient_quota | Account credits exhausted; key itself fine |
| Groq | ✅ | ✅ ok | None |
| Cerebras | ✅ | ⚠️ queue_exceeded on qwen-3-235b | Smaller models work; large under load fails |
| Google AI Studio | ✅ | ❌ on `gemini-2.0-flash`, ✅ on `gemini-2.5-flash` | Our code uses deprecated model ID |
| OpenRouter | ✅ | ❌ Key limit exceeded (paid), ✅ `:free` models | Per-key cap set to $0; account has $5.26 in credits remaining |

## .env parser hazard

`WINRESOURCE_36GB_SSH_PASSWORD=77777TGBmi&&&&&` contains unquoted `&` chars; bash `source .env` aborts at line 40 with a syntax error and silently leaves all later vars unset (including OPENAI_API_KEY). Node's dotenv parses the same file correctly. Any bash script that does `source .env` for cloud-provider keys will appear to have empty cloud creds. Quote the value (`'77777TGBmi&&&&&'`) or move it before any line shells need to read.

## Recommendations summary

1. Populate / fix OpenAI billing OR remove dispatch routes that target it (already failing silently).
2. Raise per-key cap on OpenRouter API key in dashboard (account credits remain).
3. Update Gemini model IDs in dispatcher: `gemini-2.0-flash` → `gemini-2.5-flash` or `gemini-2.5-flash-lite-001`.
4. Set `OLLAMA_KEEP_ALIVE=24h` system env var on Windows hosts to fix cold-load regressions.
5. Quote `.env` values containing shell metacharacters.
6. Reconcile `inventory/devices.json` to live `/api/tags` output OR install the missing models.

## Per-device upgrade ideas (for Manager review)

### 36gbwinresource (4 GB VRAM)

Current: qwen2.5-coder:7b at Q4_K_M. Better fits within 4 GB:
- qwen2.5-coder:7b at IQ3/Q3 with `num_ctx=2048` keeps KV under ~1 GB → headroom for re-quant or 14B-IQ3 attempts
- Watch: Qwen3-coder 4B (April 2026) being benchmarked as best-in-tier for sub-4 GB
- Starcoder2-3b is the only credible non-Qwen alternative at this VRAM

### OpenClaw (16 GB RAM, CPU only)

Switching from Ollama to llama.cpp (or llamafile single-binary) on identical 7B model gives ~50% speedup on CPU per Justine Tunney's matmul work. Going 13–14B drops to 1–2 tok/s — worse than current. Right move: same model, faster engine.

### penguin-1 (≤880 MB free RAM)

Underutilized. Permanently-on, low-RAM patterns that reduce upstream tokens:
- MiniLM-L6-v2 embedder (~80 MB FP32, ~43 MB FP16) for local doc embedding
- FlashRank lite reranker (<100 MB) for top-k pre-filtering
- Hybrid BM25 + vector index via sqlite FTS5 + sentence-transformers
- "Tool runner" sandbox exposing curated commands (grep, jq, sqlite, ripgrep, git log) over Tailscale as MCP tools — larger models call instead of paying tokens to stream files
- Doc pre-processor: chunk + summarize-extract via gemma3:270m on-device, push to wiki

## Related context

- Karpathy LLM Wiki v2 (April 2026) — typed relationships, decay-based trust, find-contradictions audits
- Initializer-executor split agent harness pattern (Anthropic) — cleanest no-daemon model
- GitHub Actions schedule (with off-peak minutes + self-healing catch-up) is dominant zero-install scheduling option
