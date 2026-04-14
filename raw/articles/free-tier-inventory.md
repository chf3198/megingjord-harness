# Free-Tier AI Service Inventory

**Last updated**: 2026-04-11

## Summary Table

| Service | Free Tier | Key Models | Rate Limits | Vision |
|---|---|---|---|---|
| Google AI Studio | ✅ Generous | Gemini 2.5 Pro/Flash, 3.x, Gemma 4 | Varies per model | ✅ |
| Groq | ✅ Limited | Llama 3.x, Qwen3-32B, Whisper | 30 RPM, 1K RPD | ❌ |
| Cerebras | ✅ Free tier | GPT-OSS-120B, Llama 3.x, Qwen3-235B | Rate-limited | ❌ |
| Cloudflare Workers AI | ✅ 10K neurons/day | Llama 3.2-11B vision, Gemma 4, Qwen3 | Neuron-based | ✅ |
| HuggingFace Inference | ✅ Free tier | Thousands of open models | Rate-limited | ✅ |
| SambaNova | ⚠️ Unreliable | Various (deprecating models frequently) | 20 RPM (dev) | ❌ |
| OpenRouter | ✅ Free models | Routes to free provider models | Varies | Varies |
| Mistral | ✅ Open models | Small 4, Large 3, Codestral, Ministral | TBD | ❌ |

## Google AI Studio (PRIMARY — Highest Value)

- **URL**: https://aistudio.google.com
- **Free models**: Gemini 2.5 Pro, 2.5 Flash, 2.5 Flash-Lite, 3 Flash, 3.1 Flash-Lite, Gemma 4
- **Free features**: Vision, audio, code execution, embeddings, search grounding (500 RPD)
- **Why primary**: Most generous free tier, frontier-class models, multimodal

## Groq (SECONDARY — Fast Burst)

- **URL**: https://console.groq.com
- **Key limits**: llama-3.1-8b (14.4K RPD), llama-3.3-70b (1K RPD), qwen3-32b (1K RPD)
- **Whisper**: 20 RPM, 2K RPD (audio transcription)
- **Why secondary**: Extremely fast inference, good for burst workloads

## Cerebras (TERTIARY — Ultra-Fast)

- **URL**: https://cloud.cerebras.ai
- **Free tier**: Access to all models, community Discord support
- **Dev tier**: $10 minimum, 10x higher rate limits
- **Key models**: GPT-OSS-120B (~3000 tok/s), Llama 3.1-8B (~2200 tok/s)

## Cloudflare Workers AI (VISION — Primary)

- **Free**: 10,000 neurons/day on Workers Free plan
- **Paid**: $0.011/1K neurons on Workers Paid ($5/mo)
- **Vision model**: `@cf/meta/llama-3.2-11b-vision-instruct` ← KEY
- **Also**: flux-1-schnell (image gen), whisper (audio), embeddings

## Actionable Next Steps

1. Sign up for Cerebras free tier and test API
2. Set up Google AI Studio API key
3. Wire Cloudflare Workers AI vision endpoint
4. Build quota-tracking module in dashboard
