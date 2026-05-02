# Megingjord — Architecture

Governance-first multi-runtime AI agent harness. This document is a navigation
map; each subsystem links to the canonical source files where details live.

## High-level data flow

```
Editor / Agent runtime         Routing               Execution                Governance
───────────────────────        ───────────           ─────────────            ──────────────
VS Code Copilot          ─→    cascade-dispatch ─→  Fleet (Ollama via         GitHub issues +
Claude Code                    + model-routing-     Tailscale)                workflows + skills
Codex                          policy.json          OR Cloud (Claude /        + scripts/global/
                                                    OpenAI / Groq /
                                                    Cerebras / Google AI)
                                                       │
                                                       ▼
                                          .dashboard/events.jsonl
                                                       │
                                                       ▼
                                                Dashboard (SSE)
```

## Subsystems

### Routing

- `scripts/global/cascade-dispatch.js` — fleet-first cascade (Free → Fleet → Haiku → Premium)
- `scripts/global/model-routing-policy.json` — capability matrix, lane order
- `scripts/global/task-router-dispatch.js` — direct dispatch to a tier
- `scripts/global/free-router.js` — free-model orchestrator MVP (#786): classifier + signal stack picks a tier, calls a free LLM (Groq) when available, falls back to deterministic cascade-dispatch
- `agents/router.agent.md` — Routing role definition

### Capability detection / cost-reduction (ADR-013)

- `scripts/global/capability-probe.js` + `capability-show.js` — probe providers, fleet hosts, toolchain; write/read `.dashboard/capabilities.json`
- `scripts/global/rag-search.js` (#784) — repo-context search; MCP-first with ripgrep fallback
- `scripts/global/state-offload-client.js` (#792) — per-turn state offload to a Worker
- Optional features gate on the capability manifest, so a missing provider or offline fleet host degrades gracefully

### Governance

- `.github/workflows/` — baton-gates, evidence-completeness, doc-update-gate, label-lint, etc.
- `scripts/global/governance-drift-classifier.js` — drift detection
- `scripts/global/ticket-reconcile.js` — local↔GitHub ticket consistency
- `scripts/global/epic-close-validator.js` — epic close-readiness

### Wiki (LLM Knowledge System)

- `~/.copilot/wiki/` — compiled wiki (read-only from non-Megingjord repos)
- `wiki/` (this repo) — source markdown that compiles into the above
- `~/.copilot/scripts/wiki-search.js` — search CLI used by `npm run help:topic`
- `scripts/wiki/ingest.js`, `lint.js`, `anneal.js` — pipeline

### Dashboard

- `dashboard/index.html` — Alpine.js shell, all panels declared as `<template>`
- `dashboard/js/app.js` — `dashboardApp()` Alpine root component, refresh cycle
- `dashboard/js/render-panels.js` — pure functions returning HTML for each panel
- `dashboard/js/event-source.js` + `event-bus.js` — SSE client + JSONL polling
- `scripts/dashboard-server.js` — Node HTTP server :8090, SSE handler

### Fleet

- `inventory/devices.json` — Tailscale IPs, Ollama models, GPU/CPU class (reconciliation tracked in #765)
- `scripts/health-check.js` — fleet connectivity probe
- `wiki/entities/{36gbwinresource,openclaw,penguin-1}.md` — per-device authoritative state
- Runtime targets (post-2026-05-01 IT pass, SYSTEM-service Ollama):
  - `36gbwinresource` — Win11 Pro, Quadro T2000 4 GB VRAM; starcoder2:3b at 95 TPS (full GPU), qwen2.5-coder:32b at 1.6 TPS (max-quality)
  - `openclaw` — CPU-only Win10, 16 GB RAM; deepseek-coder-v2:lite at 8.4 TPS (16B MoE primary)
  - `penguin-1` — ChromeOS LXC, ~880 MB free RAM; SLM utility role (qwen3:0.6b, gemma3:270m, nomic-embed-text, snowflake-arctic-embed:m)

## Data flows

- **Events** — agents/tools append JSONL to `.dashboard/events.jsonl`; dashboard server tails the file and broadcasts via SSE; clients render in Live Activity / Baton panels.
- **Baton** — every issue is a baton; roles transition Manager → Collaborator → Admin → Consultant; each posts a named handoff comment; CI gates verify the trail.
- **State** — short-term state in `.dashboard/state/` (gitignored); long-term truth in GitHub issues/PRs.

## Deployment targets

- `~/.copilot/` — Copilot runtime install root (skills, hooks, scripts, wiki)
- `~/.claude/` — Claude Code install root (commands, agents, hooks)
- `~/.codex/` — Codex runtime install root
- Megingjord repo — source of truth; nothing is edited in deployed roots directly

## Cross-runtime sync

- `scripts/sync.sh` — copy from repo to runtime root (copilot/claude/codex/all)
- `scripts/deploy.sh` — sync + post-deploy hooks (`npm run deploy:apply`)
- Per-runtime targets via `--target` flag

## Related documents

- `docs/HELP-GUIDELINES.md` — HELP panel UX patterns
- `docs/DECISIONS.md` — index of architecture decision records
- `docs/STYLE-GUIDE.md` — terminology
- `research/adr/` — full ADR set
