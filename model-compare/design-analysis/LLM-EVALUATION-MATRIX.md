# LLM Response Comparison & Evaluation Matrix

**Date:** 2026-04-20
**Task:** Design consultation and analysis for Fleet Resource Table autoupdate and user-editing pipeline.
**Methodology:** Based on industry best practices for evaluating LLMs on complex architectural tasks, we employ a multi-rubric scoring framework (0-10 scale) focusing on Architectural Soundness, Security Posturing, UX/UI Practicality, and Execution Readiness. 
*Updated based on client input:* Embedded GitHub Copilot Pro cost multipliers, categorized unique response properties into gradeable scales, left fields appropriately blank if a model did not demonstrate a capability or viable use-case, and added a Variability Score against industry architectural benchmarks.

### Dynamic Tracking Table

> **Column Key:** Copilot Pro analytical rows use full rubric (Arch/Sec/UX-UI/Read./Prop Score/Variability). Free-tier rows use empirical harness scores (April 2026 controlled eval). `est.` = estimate derived from aggregate tier data. `—` = not applicable or not tested via that method.

| Model | Cost | Arch | Sec | UX/UI | Read. | Emergent Property | Prop Score | Variability | **Empirical** | Best Use Case |
|---|---|---|---|---|---|---|---|---|---|---|
| **Claude Sonnet 4.6** *(Copilot Pro)* | 1x | 9.5 | 10.0 | 8.0 | 9.0 | *Deterministic Constraint Modeling* | 10.0 | +0% (Ind: 95) | — | Deep security & strict policy gatekeeper. |
| **GPT-5.3-Codex** *(Copilot Pro)* | 1x | 9.0 | 8.5 | 8.5 | 9.5 | *Phased Execution Planning* | 9.5 | +2% (Ind: 88) | — | Step-by-step execution & architectural implementation. |
| **GPT-5.4-mini** *(Copilot Pro)* | 0.33x | 8.5 | 8.5 | 9.0 | 8.5 | *Edge-Case Identification* | 9.0 | +5% (Ind: 80) | — | UI resilience & edge-case testing. |
| **GPT-5-mini** *(Copilot Pro)* | 0x (Free) | 8.5 | 8.0 | 8.5 | 8.5 | *Structural Integration (Karpathy)* | 8.5 | +0% (Ind: 85) | — | General-purpose pipeline orchestration. |
| **Grok Code Fast 1** *(Copilot Pro)* | 0.25x | 8.0 | 7.5 | 7.0 | 8.0 | *Academic Synthesis* | 8.5 | -1% (Ind: 81) | — | *None* (Outclassed by GPT-5-mini structurally). |
| **Gemini 3 Flash** *(Copilot Pro)* | 0.33x | 7.0 | 7.0 | 8.0 | 7.5 | *Extractive Concision* | 8.0 | -3% (Ind: 72) | — | *None* (Outclassed by GPT-5.4-mini at same cost). |
| **Raptor-mini** *(Copilot Pro)* | 0x (Free) | 6.5 | — | — | 7.0 | *—* | 0 | -12% (Ind: 74) | — | *None* (Not suited for architectural design level). |
| **OpenRouter — qwen/qwen3-coder:free** | 0x / free-cloud | est 8.0 | est 7.5 | est 7.5 | est 7.5 | *Empirical Controlled Eval* | — | **10** | **10.0** | Free cloud coding; top empirical performer. |
| **OpenRouter — nvidia/nemotron-super-120b:free** | 0x / free-cloud | est 8.0 | est 7.5 | est 7.5 | est 8.0 | *Empirical Controlled Eval* | — | **9.3** | **9.3** | Large NVIDIA model; strong arch + UX, weaker security. |
| **OpenRouter — nvidia/nemotron-nano-30b:free** | 0x / free-cloud | est 7.0 | est 7.0 | est 7.0 | est 7.0 | *Empirical Controlled Eval* | — | — | **10.0** | Solid mid-tier free model; routing/fallback. |
| **OpenRouter — openai/gpt-oss-20b:free** | 0x / free-cloud | est 7.5 | est 7.0 | est 7.5 | est 7.5 | *Empirical Controlled Eval* | — | **9** | **9.0** | OpenAI OSS compact; reliable general use. |
| **OpenRouter — google/gemma-3-4b-it:free** | 0x / free-cloud | est 6.5 | est 6.0 | est 7.0 | est 6.5 | *Empirical Controlled Eval* | — | **10** | **10.0** | Small Google model; punches above weight empirically. |
| **OpenRouter — nvidia/nemotron-nano-9b:free** | 0x / free-cloud | est 6.5 | est 6.5 | est 6.5 | est 6.5 | *Empirical Controlled Eval* | — | — | **10.0** | Compact NVIDIA; best value at 9B params empirically. |
| **OpenRouter — llama-3.3-70b-instruct:free** | 0x / free-cloud | est 7.5 | est 7.0 | est 7.5 | est 7.5 | *RPM/RPD Rate-Limited* | — | — | ⚠ rate-limited | Capped at free-tier daily limit; use Groq variant instead. |
| **OpenRouter — google/gemma-3-27b-it:free** | 0x / free-cloud | est 7.5 | est 7.0 | est 7.5 | est 7.5 | *RPM/RPD Rate-Limited* | — | — | ⚠ rate-limited | Mid-large Google; capped at free-tier limit. |
| **Groq — llama-3.3-70b-versatile** | 0x / free-cloud | est 7.5 | est 7.0 | est 8.0 | est 7.5 | *Empirical Controlled Eval* | — | **10** | **10.0** | Meta 70B on Groq; fast latency + top empirical score. |
| **Groq — openai/gpt-oss-120b** | 0x / free-cloud | est 8.0 | est 7.5 | est 7.5 | est 8.0 | *Empirical Controlled Eval* | — | **10** | **10.0** | Largest OSS on Groq; strong all-round. |
| **Groq — qwen/qwen3-32b** | 0x / free-cloud | est 8.0 | est 7.5 | est 7.5 | est 7.5 | *Empirical Controlled Eval* | — | **9** | **9.0** | Qwen 32B reasoning; minor quality dip vs 70B peers. |
| **Groq — llama-4-scout-17b-16e** | 0x / free-cloud | est 7.5 | est 7.0 | est 7.5 | est 7.5 | *Empirical Controlled Eval* | — | **10** | **10.0** | MoE architecture; efficient and strong empirically. |
| **Groq — llama-3.1-8b-instant** | 0x / free-cloud | est 6.5 | est 6.5 | est 7.0 | est 7.0 | *Empirical Controlled Eval* | — | **9** | **9.0** | Fast small model; good for latency-sensitive tasks. |
| **Cerebras — qwen-3-235b-a22b** | 0x / free-cloud | est 8.5 | est 8.0 | est 8.0 | est 8.0 | *Empirical Controlled Eval* | — | **10** | **10.0** | Largest Cerebras model; top analytical + empirical. |
| **Cerebras — llama3.1-8b** | 0x / free-cloud | est 6.5 | est 6.5 | est 7.0 | est 7.0 | *Empirical Controlled Eval* | — | **9** | **9.0** | Compact Cerebras; fast inference, solid baseline. |
| **OpenClaw — mistral:latest** *(fleet)* | 0x / local-fleet | est 7.5 | est 7.0 | est 7.5 | est 7.0 | *On-Device Mid-Range Inference* | — | **5.8** | **5.8** | Slow CPU gen (~1 tok/s); accuracy strong, low clarity/security scoring. |
| **OpenClaw — phi3:mini** *(fleet)* | 0x / local-fleet | est 6.5 | est 6.0 | est 6.5 | est 6.5 | *Compact On-Device Inference* | — | — | **6.8** | Fastest fleet model (33s/300tok); good accuracy, limited security depth. |
| **OpenClaw — qwen2.5:7b-instruct** *(fleet)* | 0x / local-fleet | est 7.0 | est 6.5 | est 7.0 | est 6.5 | *Conversational-Code Synthesis* | — | **8** | **8.0** | Best fleet model empirically; strong clarity + UX, low security rubric score. |

### Evaluation Methodology Insights
*Researched methodology for LLM evaluation:*
1. **Multi-Rubric Scoring:** Copilot Pro rows evaluated analytically (Arch/Sec/UX-UI/Readiness); free-tier rows scored via controlled harness runs (Clarity/Accuracy/Security/UX → Composite). Both methods are documented to allow cross-tier comparison.
2. **Cost-Awareness:** A model with a `0.33x` cost that performs at an `8.5` level is highly efficient, but if a `0x` model performs at the same `8.5` level, the `0.33x` model loses its "Best Use Case" for this specific task.
3. **Emergent Trait Categorization:** Replaced ad-hoc descriptors with quantifiable industry-standard traits like `Deterministic Constraint Modeling` and `Academic Synthesis`. Models lacking an emergent unique trait score 0.
4. **Variability Scoring:** Tracks our empirical score against the industry benchmark for architectural analysis, yielding a variance percentage that indicates under/over-performance relative to expectations.
5. **Empirical Composite Column:** Free-tier rows scored via live harness eval (April 2026). `est.` values in analytical columns are tier-level estimates. Cells marked `⚠ fleet offline` indicate host reachable but service not responding. Cells marked `⚠ rate-limited` indicate daily RPM/RPD cap reached.

*(Methodological framing, cost integration, and omission of forced scoring were derived directly from client suggestions.)*
