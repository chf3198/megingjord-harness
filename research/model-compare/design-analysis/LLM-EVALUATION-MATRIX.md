# LLM Response Comparison & Evaluation Matrix

> **Refreshed via `npm run routing:refresh` (#833).** Header dates are stamped automatically; CI gate `model-matrix-refresh / matrix-freshness` fails when the `Last refreshed:` line is more than 60 days old. Live provider/model snapshot lives in `.dashboard/routing-snapshot.json` (gitignored, per-install).

**Date:** 2026-05-03
**Last refreshed:** 2026-05-03
**Snapshot:** `.dashboard/routing-snapshot.json`
**Last refreshed:** 2026-05-03
**Snapshot:** `.dashboard/routing-snapshot.json`
**Task:** Design consultation and analysis for Fleet Resource Table autoupdate and user-editing pipeline.
**Methodology:** Based on industry best practices for evaluating LLMs on complex architectural tasks, we employ a multi-rubric scoring framework (0-10 scale) focusing on Architectural Soundness, Security Posturing, UX/UI Practicality, and Execution Readiness. 
*Updated based on client input:* Embedded GitHub Copilot Pro cost multipliers, categorized unique response properties into gradeable scales, left fields appropriately blank if a model did not demonstrate a capability or viable use-case, and added a Variability Score against industry architectural benchmarks.

### Dynamic Tracking Table

> **Column Key:** All models scored on the same 0–10 rubric. `Arch` = Architectural Soundness, `Sec` = Security Posturing, `UX/UI` = UX Practicality, `Read.` = Execution Readiness, `Empirical` = live harness composite (April 2026 controlled eval). Copilot Pro rows are analytically scored (no API access for harness). `est.` = tier-level estimate. `—` = not evaluated via that method. `⚠ rate-limited` = daily free-tier cap reached. `⚠ not installed` = model removed from fleet host.

| Model | Tier / Cost | Arch | Sec | UX/UI | Read. | Empirical | Best Use Case |
|---|---|---|---|---|---|---|---|
| **Claude Sonnet 4.6** *(Copilot Pro)* | Pro / 1x | 9.5 | 10.0 | 8.0 | 9.0 | — | Deep security & strict policy gatekeeper. |
| **GPT-5.3-Codex** *(Copilot Pro)* | Pro / 1x | 9.0 | 8.5 | 8.5 | 9.5 | — | Step-by-step execution & architectural implementation. |
| **GPT-5.4-mini** *(Copilot Pro)* | Pro / 0.33x | 8.5 | 8.5 | 9.0 | 8.5 | — | UI resilience & edge-case testing. |
| **GPT-5-mini** *(Copilot Pro)* | Pro / 0x | 8.5 | 8.0 | 8.5 | 8.5 | — | General-purpose pipeline orchestration. |
| **Grok Code Fast 1** *(Copilot Pro)* | Pro / 0.25x | 8.0 | 7.5 | 7.0 | 8.0 | — | *None* — outclassed by GPT-5-mini structurally. |
| **Gemini 3 Flash** *(Copilot Pro)* | Pro / 0.33x | 7.0 | 7.0 | 8.0 | 7.5 | — | *None* — outclassed by GPT-5.4-mini at same cost. |
| **Raptor-mini** *(Copilot Pro)* | Pro / 0x | 6.5 | — | — | 7.0 | — | *None* — not suited for architectural design tasks. |
| **Cerebras — qwen-3-235b-a22b** | Free-cloud / 0x | est 8.5 | est 8.0 | est 8.0 | est 8.0 | **10.0** | Largest Cerebras model; top analytical + empirical. |
| **OpenRouter — qwen/qwen3-coder:free** | Free-cloud / 0x | est 8.0 | est 7.5 | est 7.5 | est 7.5 | **10.0** | Free cloud coding; tied for top empirical score. |
| **OpenRouter — nvidia/nemotron-super-120b:free** | Free-cloud / 0x | est 8.0 | est 7.5 | est 7.5 | est 8.0 | **9.3** | Large NVIDIA model; strong arch + UX, weaker security. |
| **Groq — openai/gpt-oss-120b** | Free-cloud / 0x | est 8.0 | est 7.5 | est 7.5 | est 8.0 | **10.0** | Largest OSS on Groq; strong all-round. |
| **Groq — qwen/qwen3-32b** | Free-cloud / 0x | est 8.0 | est 7.5 | est 7.5 | est 7.5 | **9.0** | Qwen 32B reasoning; minor quality dip vs 70B peers. |
| **OpenRouter — nvidia/nemotron-nano-30b:free** | Free-cloud / 0x | est 7.0 | est 7.0 | est 7.0 | est 7.0 | **10.0** | Solid mid-tier free model; good routing/fallback choice. |
| **Groq — llama-3.3-70b-versatile** | Free-cloud / 0x | est 7.5 | est 7.0 | est 8.0 | est 7.5 | **10.0** | Meta 70B on Groq; fast latency + top empirical score. |
| **Groq — llama-4-scout-17b-16e** | Free-cloud / 0x | est 7.5 | est 7.0 | est 7.5 | est 7.5 | **10.0** | MoE architecture; efficient and strong empirically. |
| **OpenRouter — llama-3.3-70b-instruct:free** | Free-cloud / 0x | est 7.5 | est 7.0 | est 7.5 | est 7.5 | ⚠ rate-limited | Daily cap reached; use Groq variant instead. |
| **OpenRouter — google/gemma-3-27b-it:free** | Free-cloud / 0x | est 7.5 | est 7.0 | est 7.5 | est 7.5 | ⚠ rate-limited | Mid-large Google model; daily cap reached. |
| **OpenRouter — openai/gpt-oss-20b:free** | Free-cloud / 0x | est 7.5 | est 7.0 | est 7.5 | est 7.5 | **9.0** | OpenAI OSS compact; reliable general use. |
| **Groq — llama-3.1-8b-instant** | Free-cloud / 0x | est 6.5 | est 6.5 | est 7.0 | est 7.0 | **9.0** | Fast small model; good for latency-sensitive tasks. |
| **Cerebras — llama3.1-8b** | Free-cloud / 0x | est 6.5 | est 6.5 | est 7.0 | est 7.0 | **9.0** | Compact Cerebras; fast inference, solid baseline. |
| **OpenRouter — google/gemma-3-4b-it:free** | Free-cloud / 0x | est 6.5 | est 6.0 | est 7.0 | est 6.5 | **10.0** | Small Google model; punches well above its weight class. |
| **OpenRouter — nvidia/nemotron-nano-9b:free** | Free-cloud / 0x | est 6.5 | est 6.5 | est 6.5 | est 6.5 | **10.0** | Compact NVIDIA; best value at 9B params empirically. |
| **OpenClaw — qwen2.5:7b-instruct** *(fleet)* | Local-fleet / 0x | est 7.0 | est 6.5 | est 7.0 | est 6.5 | **8.0** | Best fleet model empirically; strong clarity + UX. |
| **OpenClaw — qwen2.5-coder:7b** *(fleet)* | Local-fleet / 0x | est 7.5 | est 7.0 | est 7.5 | est 7.5 | **7.0** | Coding-tuned 7B; 1.3 tok/s CPU-only; use when GPU nodes unavailable. |
| **OpenClaw — phi3:mini** *(fleet)* | Local-fleet / 0x | est 6.5 | est 6.0 | est 6.5 | est 6.5 | ⚠ not installed | Removed from OpenClaw fleet (2026-05-01). |
| **OpenClaw — mistral:latest** *(fleet)* | Local-fleet / 0x | est 7.5 | est 7.0 | est 7.5 | est 7.0 | ⚠ not installed | Removed from OpenClaw fleet (2026-05-01). |

### Evaluation Methodology Insights
*Researched methodology for LLM evaluation:*
1. **Multi-Rubric Scoring:** Copilot Pro rows evaluated analytically (Arch/Sec/UX-UI/Readiness); free-tier rows scored via controlled harness runs (Clarity/Accuracy/Security/UX → Composite). Both methods are documented to allow cross-tier comparison.
2. **Cost-Awareness:** A model with a `0.33x` cost that performs at an `8.5` level is highly efficient, but if a `0x` model performs at the same `8.5` level, the `0.33x` model loses its "Best Use Case" for this specific task.
3. **Emergent Trait Categorization:** Replaced ad-hoc descriptors with quantifiable industry-standard traits like `Deterministic Constraint Modeling` and `Academic Synthesis`. Models lacking an emergent unique trait score 0.
4. **Variability Scoring:** Tracks our empirical score against the industry benchmark for architectural analysis, yielding a variance percentage that indicates under/over-performance relative to expectations.
5. **Empirical Composite Column:** Free-tier rows scored via live harness eval (April 2026). `est.` values in analytical columns are tier-level estimates. Cells marked `⚠ fleet offline` indicate host reachable but service not responding. Cells marked `⚠ rate-limited` indicate daily RPM/RPD cap reached.

*(Methodological framing, cost integration, and omission of forced scoring were derived directly from client suggestions.)*
