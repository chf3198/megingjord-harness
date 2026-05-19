# Megingjord — Architecture

Navigation map for the governance-first multi-runtime AI agent harness.

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
- `scripts/global/free-router.js` — free-model orchestrator; classifier + signal stack, falls back to cascade-dispatch
- `agents/router.agent.md` — Routing role definition

### Capability detection (ADR-013)

- `scripts/global/capability-probe.js` + `capability-show.js` — probe providers, fleet hosts, toolchain
- `scripts/global/rag-search.js` — repo-context search; MCP-first with ripgrep fallback
- `scripts/global/state-offload-client.js` — per-turn state offload to a Worker

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
- `wiki/entities/{36gbwinresource,openclaw,penguin-1}.md` — per-device authoritative state

## Data flows

- **Events** — agents/tools append JSONL to `.dashboard/events.jsonl`; dashboard SSE broadcasts to clients.
- **Baton** — every issue is a baton; roles transition Manager → Collaborator → Admin → Consultant; CI gates verify the trail.
- **State** — short-term state in `.dashboard/state/` (gitignored); long-term truth in GitHub issues/PRs.

## Deployment model — two layers

The harness operates in two independent layers per machine:

**Global layer** (deployed once, shared by all projects):
- `~/.copilot/` — Copilot skills, instructions, hooks, scripts, wiki
- `~/.claude/` — Claude Code commands, agents, hooks
- `~/.codex/` — Codex AGENTS.md, config, rules

**Workspace layer** (per-project, committed to each project repo):
- `.github/copilot-instructions.md`, `CLAUDE.md`, `AGENTS.md`
- `.claude/settings.json`, `.codex/`

All three runtimes (Copilot, Claude Code, Codex) are first-class: the same
source deploys to all three. See [`docs/howto/installation.md`](howto/installation.md).

## Cross-runtime sync

- `scripts/sync.sh` — pull from runtime root into repo
- `scripts/deploy.sh` — deploy repo to global runtime roots; `--target copilot|claude|codex|both|all`

## Related documents

- `docs/howto/installation.md` — install walkthrough, two-layer model
- `docs/HELP-GUIDELINES.md` — HELP panel UX patterns
- `docs/DECISIONS.md` — architecture decision records; `docs/STYLE-GUIDE.md` — terminology
- `research/adr/` — full ADR set
