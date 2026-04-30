---
name: Global Task Router
description: Route work through local-first cascade lanes with capability matrix. Local fleet is second-highest priority goal.
applyTo: "**"
---

# Global Task Router

Policy source: `scripts/global/model-routing-policy.json` (capability_matrix field).

## Lane order (cost-ascending mandate)

1. **Free** — Auto tier. Lookup, analysis, docs, Q&A, boilerplate. Zero tokens.
2. **Fleet** — Ollama local (qwen2.5:7b-instruct). Medium implementation, known-pattern
   coding, config gen, log analysis. Zero tokens. **Execute via cascade-dispatch.**
3. **Haiku** — claude-haiku-4-5-20251001. Single-file refactors, test gen, code review.
4. **Premium** — claude-sonnet-4-6. Multi-file architecture, security, ambiguous debugging.

## Capability matrix (use for ticket assignment and lane selection)

| Dimension | Fleet (local) | Haiku | Premium |
|---|---|---|---|
| Reasoning depth | Lookup / extraction / slot-fill | 2–3 step reasoning | Multi-hop / planning / proof |
| Code complexity | Autocomplete, boilerplate, single fn | Single-file refactor, test gen | Multi-file, cross-module arch |
| Context length | <8K tokens | 8K–32K | >32K / large-context coherence |
| Tool-call chain | 1–2 calls, well-specified | 3–4 calls with retry | 5+ calls, long-horizon agent |
| Ambiguity level | Well-specified + clear schema | Multi-constraint + some ambiguity | Underspecified / OOD |

**Direct-to-Premium** (skip cascade): security review, vulnerability audit, architecture design,
incident response, cross-system trade-off, concurrency analysis.

## Fleet execution mandate

For fleet-lane tasks ≥6 words, the hook runs `cascade-dispatch.js --execute` against Ollama.
If fleet response is high-confidence: incorporate the returned content, do NOT regenerate.
If fleet signals `escalation_needed=true`: use the `suggested_tier` (haiku first, not premium).

## Escalation rules

- Start in lowest adequate lane; never skip haiku to reach premium.
- Premium escalation requires a short rationale. Record: lane, model, rationale, trigger.
- If premium share exceeds 20% over 7 days, routing engine forces fleet lane (`npm run routing:report`).
