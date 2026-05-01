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
- `agents/router.agent.md` — Routing role definition

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

- `inventory/devices.json` — Tailscale IPs, Ollama models, GPU/CPU class
- `scripts/health-check.js` — fleet connectivity probe
- Runtime targets: `36gbwinresource` (GPU 32 TPS), `OpenClaw` (CPU 7 TPS), `penguin-1` (micro)

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
