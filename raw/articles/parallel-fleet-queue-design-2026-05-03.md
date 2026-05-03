---
title: "Parallel Fleet Access — Global Queue Design"
type: research
created: 2026-05-03
status: pending
tags: [fleet, queue, multi-team, tailscale, cost-minimization, install-agnostic]
sources: ["[[fleet-architecture]]", "[[cascade-dispatch]]", "[[free-router]]"]
---

# Parallel Fleet Access — Global Queue Design

**Date**: 2026-05-03
**Ticket**: #781 (research only; implementation children NOT spawned until client approves)
**Lane**: docs-research

## Vision (recap)

A global queue + skill/tool surface so any coding agent (Claude Code, Copilot, Codex, Continue, Cursor, Aider) can submit fleet-bound work, wait politely for the right Tailscale node, and only escalate to non-free resources after the queue itself signals "no fleet capacity for the next N minutes" — not on the first slow response. Composes on top of `cascade-dispatch.js` (#786) and the multi-agent identity primitive (#737).

## Free-fleet usage during this research

- **Cerebras qwen-3-235b-a22b-instruct-2507** drafted Q5–Q10 (wait/escalate, backpressure, observability, fairness, pre-emption, cross-runtime auth) — large free-tier model, fast.
- **36gbwinresource qwen2.5-coder:32b** drafted Q4 (per-vendor skill/tool surfaces) — slow Q4 CPU-offload, deep reasoning, free.
- **Groq llama-3.3-70b-versatile** drafted Q1–Q3 (substrate, job model, capacity awareness) — fast, free.
- Zero paid LLM tokens consumed for content.

## Q1 — Queue substrate

| Substrate | Latency | Durability | Install-agnostic | Cost |
|---|---|---|---|---|
| **SQLite-WAL over Tailscale (#739)** | <5 ms local | crash-safe; WAL replay | ✅ no daemon mandate | $0 |
| Cloudflare Worker DO (#740 optional) | 30–60 ms | strongly durable | optional (skipped when no Cloudflare) | $0 free tier; pay above |
| Redis-via-Tailscale | <2 ms | replicate via AOF | ❌ requires Redis daemon | $0 self-host |
| Lock-file (filesystem) | <1 ms | brittle | ✅ | $0 |

**Decision**: Layered. **SQLite-WAL is the default substrate** (already shipped in #739). When Cloudflare Worker capability is detected (`.dashboard/capabilities.json` from #788), prefer the Worker DO for cross-machine fan-out (lets Claude Code on penguin-1 contend cleanly with Copilot on the dev machine). Lock-file is the degenerate-case fallback when neither is available. Redis is rejected — daemon mandate violates install-agnostic.

## Q2 — Job model

Per-request job, not persistent connection. Job shape:

```json
{
  "id": "uuid",
  "team": "claude-code|copilot|codex|continue|cursor|aider",
  "agent_id": "<#737 identity>",
  "tier": "fim-coding|heavy-coding|embeddings|reasoning",
  "host_pref": ["36gbwinresource","windows-laptop","penguin-1"],
  "payload": {"...ollama /api/generate body..."},
  "max_wait_ms": 60000,
  "escalation_path": ["groq","cerebras","openrouter","haiku"],
  "submitted_at": "ISO-8601",
  "trace_id": "uuid"
}
```

Servicing: tier-scoped weighted round-robin (see Q8) with aging-based starvation prevention. No persistent connections — per-job cost outweighs the multiplexing benefit at this scale (≤6 contending teams typical).

**Decision**: per-request job, FIFO-within-team, WRR across teams, age-promoted to front when wait > 80% of `max_wait_ms`.

## Q3 — Capacity awareness

Three signal sources composited:

1. **Per-host worker heartbeat** every 5 s into the substrate: `{host, free_vram_mb, loaded_models, ps_count}`. Authoritative; cheap.
2. **Ollama `/api/ps`** poll on dequeue intent, ≤500 ms timeout. Detects mid-flight loaded model.
3. **Tailscale node liveness** via `tailscale ping` cached 30 s; treats unreachable as "host unavailable" without flapping.

Heartbeat is primary; `/api/ps` is corrective; `tailscale ping` is liveness gate. The dashboard's existing fleet-health probe (#595) is reused as a metrics source.

**Decision**: heartbeat-primary with `/api/ps` corroboration on contended dequeue.

## Q4 — Per-vendor skill/tool surfaces

(36gbwinresource fleet draft, refined.)

| Vendor | Surface |
|---|---|
| **Claude Code** | `.claude/skills/fleet-dispatch/SKILL.md` + `.claude/commands/fleet-submit.md`. Auto-deployed via `npm run deploy:claude:apply`. Submission via skill calls a Node entrypoint that POSTs to the queue substrate. |
| **Copilot** | `.github/copilot-instructions.md` directive + an MCP server (`mcp.fleet-dispatch`) registered in repo `mcp.json`. Copilot routes Ollama-bound calls through the MCP tool, not direct fleet endpoints. |
| **Codex** | `.codex/agents/fleet-dispatch.toml` agent definition + a `.codex/hooks/pre-tool-call.json` hook that intercepts Ollama calls and rewrites to the queue. |
| **Continue.dev** | `config.yaml` provider entry pointing at the queue's OpenAI-compatible shim (`http://queue/v1`). Queue forwards to fleet host once dequeued. |
| **Cursor** | Globally registered MCP tool (`fleet-dispatch.mcp.json`) installed at `~/.cursor/mcp.json`. Tool blocks until dequeue or returns escalation reason. |
| **Aider** | `--model-metadata-file fleet-dispatch.json` flag wrapper or a wrapper script `aider-via-fleet` that exports `OPENAI_API_BASE=http://queue/v1`. |

Common contract across vendors: every surface eventually POSTs the Q2 job shape to the queue substrate; identity is the #737 token.

## Q5 — Wait-vs-escalate policy template

(Cerebras 235B draft, kept verbatim — well-grounded.)

Tier- and team-configurable via `fleet-queue-policy.json`, loaded at `npm run setup`. Default thresholds: 60 s for high-VRAM tiers (36gbwinresource), 30 s for SLM/embedding tiers (penguin-1), 15 s for routing-only ops. Teams override via `.agentconfig/fleet-policy.json` using identity from #737. Policy schema: `max_wait_ms`, `escalation_path`, `cost_sensitivity_multiplier` (1.0 default; 5.0 locks to fleet until hard timeout). Escalation occurs only after the queue signals **sustained** saturation, not transient delay. Composes with `cascade-dispatch.js`: queue acts as a high-priority free tier before cost-tier routing engages.

## Q6 — Backpressure signaling

(Cerebras 235B draft.)

Dual channel: HTTP 202 with `Retry-After` and `X-Queue-Status: saturated` headers; optional SSE on `/queue/events`. When no slot is available within `max_wait_ms`, the queue emits `capacity.unavailable` with `estimated_clearance_time` and `suggested_escalation_tier`. Agents opt in via `Prefer: respond-async`. Polling at 2 s is the install-agnostic fallback. All signals carry `trace_id` for observability correlation.

## Q7 — Observability

(Cerebras 235B draft.)

Dashboard panels (composes with #742 multi-agent dashboard):

1. Queue depth per host (stacked by tier, by team).
2. Active waiters table (agent_id, team, tier, queued_for, escalation_risk).
3. Avg wait time per tier (10 s update, quantile-tracked).
4. Escalation-to-cloud rate (% by provider).
5. Host utilization heatmap (Ollama `/api/ps` durations).
6. Policy override audit log (tied to #737 identity).

Real-time via SSE; falls back to cached state if queue unreachable.

## Q8 — Fairness

(Cerebras 235B draft.)

**Tier-scoped, identity-aware weighted round-robin** (not pure FIFO). Default weight 1.0; elevated to ≤2.0 via `fleet-policy.json` (signed by #737). Within each tier, queue groups by team and services one job per team per cycle proportional to weight. Aging promotes any job over 80 % of `max_wait_ms`. Multi-agent-ID spoofing prevented via #737 identity coalescing. Audit log records dequeue order + weight adjustments.

## Q9 — Pre-emption

(Cerebras 235B draft, with caveat.)

Selective: Ollama's `POST /api/abort` is undocumented-but-stable; pre-empt only when a high-priority job (weight ≥ 1.8) has waited > 50 % of `max_wait_ms` AND the running job is past 90 % of expected duration. Aborted requests fall back to cloud with `escalation_reason=preempted`. Models < 4 B params skip pre-emption (fast completion makes it counter-productive). Only the queue coordinator (Tailscale-attested) may issue aborts; clients cannot.

**Caveat**: Ollama abort behavior is not officially documented; this design hedges by gating pre-emption tightly. If field testing shows zombie process issues, the recommendation is to disable pre-emption entirely and rely on aging instead.

## Q10 — Cross-runtime semantics

(Cerebras 235B draft.)

Reuse `agent-assignee-guard` JWT from #737 (team + vendor + role; bound to Tailscale node + user). Tokens are 1-hour; refreshed by the harness daemon (or via short-lived signed claims for daemon-less installs, using `tailscale whois` for node validation). Substrate-agnostic — works with SQLite or DO. End-to-end identity propagation in trace headers. No new attack surface beyond what #737 already covers.

## Coordination plan with sibling tickets

| Ticket | What it provides | This work uses it |
|---|---|---|
| #736 multi-agent command center (closed) | dashboard panels (#742) | Q7 observability surfaces compose into existing tabs |
| #737 agent identity primitive (closed) | JWT identity | Q10 auth + Q8 fairness keying |
| #739 SQLite-WAL coordination (merged) | local queue substrate | Q1 default substrate |
| #740 Cloudflare Worker + DO (merged, optional) | remote fan-out | Q1 preferred substrate when capability detected |
| #765 fleet hardware optimization (open) | per-host tier mapping | Q3 host_pref + Q5 tier defaults |
| #766 fleet maintenance loop (open) | scheduled freshness | Q3 capacity-aware refresh trigger |
| #786 free-router (merged) | cost-tier classifier | Q5 escalation_path source |
| #788 capability probe (merged) | `.dashboard/capabilities.json` | Q1 substrate selection |

## Decision matrix — queue substrate

| Criterion | SQLite-WAL | Worker DO | Lock-file |
|---|---|---|---|
| Latency | ✅ <5 ms | 30–60 ms | <1 ms |
| Durability | ✅ WAL replay | ✅ DO consensus | ❌ brittle |
| Install-agnostic | ✅ | optional | ✅ |
| Cross-machine fan-out | ❌ Tailscale-shared file | ✅ | ❌ |
| Cost | $0 | $0 within free tier | $0 |
| Already shipped | ✅ #739 | ✅ #740 | n/a |

**Winner: SQLite-WAL default with Worker DO opt-in via capability detection.**

## Out of scope (per Manager scope)

- Implementation. No code lands in this ticket.
- Implementation children. **No children spawned until client approves the research.**
- Replacing `cascade-dispatch.js` cost-tier routing. This composes on top.

## Manager review checkpoint

Implementation children to be spawned ONLY after client review:

1. Queue substrate adapter (SQLite default + Worker DO when present).
2. Per-vendor skill/tool surfaces (6 PRs, one per vendor).
3. Wait-vs-escalate policy file + loader.
4. Backpressure signaling (HTTP 202 + SSE).
5. Observability dashboard panels (#742-compose).
6. Fairness scheduler (WRR + aging).
7. Pre-emption gate (feature-flagged off by default until field tested).

## Sources

- Project context: `wiki/concepts/fleet-architecture.md`, `wiki/concepts/cascade-dispatch.md`, `wiki/concepts/free-router.md`.
- Sibling tickets: #736, #737, #739, #740, #765, #766, #786, #788.
- LLM contributions: Cerebras qwen-3-235b-a22b-instruct-2507 (Q5–Q10), 36gbwinresource qwen2.5-coder:32b (Q4), Groq llama-3.3-70b-versatile (Q1–Q3).

Refs #781
