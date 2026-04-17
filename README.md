# devenv-ops

[![License: PolyForm Noncommercial](https://img.shields.io/badge/License-PolyForm%20NC%201.0-purple.svg)](LICENSE)
[![Node ≥22](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](https://nodejs.org)
[![Lint: ≤100 lines](https://img.shields.io/badge/lint-%E2%89%A4100%20lines-blue)](#)

**AI agent governance harness — skills, agents, hooks, and wiki.**
24 universal skills ship as a VS Code Agent Plugin. Install via Git
URL or develop the harness itself for personal fleet deployment.

## Install as Agent Plugin

In VS Code (with Copilot), run:
> `Chat: Install Plugin From Source` → paste this repo's Git URL.

You get: 24 governance skills, 8 custom agents, wiki seed content.
No build step. No configuration. Works in VS Code, Copilot CLI,
and Claude Code (via `.claude-plugin/` symlink).

## How It Works

```
 User Prompt ──▶ @router (Sonnet) ──▶ classifies ──┐
                                                    │
         ┌──────────────────────────────────────────┘
         │
         ├─▶ 🧠 @architect   (Opus 4.6)   complex / architecture
         ├─▶ ⚡ @implementer (Sonnet 4.6)  standard coding
         ├─▶ 🏎️ @quick       (GPT-5 mini)  fast lookups
         └─▶ 📋 @planner     (Opus 4.6)   read-only research
```

Custom agents override VS Code Copilot AUTO model selection via
`model` frontmatter — each pinned to the optimal model for its tier.

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| AI Runtime | VS Code Copilot + 8 custom agents | LLM task routing |
| Dashboard | Alpine.js, vanilla JS/CSS | Fleet monitoring (≤50 MB) |
| Fleet | Ollama, OpenClaw (LiteLLM) | Local/remote inference |
| Network | Tailscale VPN mesh | Cross-device connectivity |
| APIs | OpenRouter, Cloudflare AI, Google AI | Free-tier access |
| QA | Playwright + Chrome DevTools Protocol | E2E + perf tests |
| Deploy | Bash rsync scripts | `~/.copilot/` deployment |

## Architecture

```
devenv-ops (source of truth)          ~/.copilot/ (runtime)
  skills/          (35) ──deploy──▶   skills/
  instructions/    (12) ──deploy──▶   instructions/
  agents/           (8) ──deploy──▶   agents/
  hooks/           (19) ──deploy──▶   hooks/
  scripts/global/  (17) ──deploy──▶   scripts/
```

## Quick Start

```bash
# Option A — native Node
npm run setup          # Install deps + confirm environment
npm start              # Dashboard on http://localhost:8090

# Option B — Docker
docker compose up      # Dashboard on http://localhost:8090
```

```bash
npm run deploy:apply   # Deploy repo → ~/.copilot/
npm run sync           # Pull ~/.copilot/ → repo
npm test               # Playwright E2E tests
npm run lint           # ≤100-line file check
```

## Enable for Other Repos

```bash
npm run repo:scope -- enable /path/to/repo
npm run repo:scope -- disable /path/to/repo
npm run repo:scope -- list
```

## Hardware Fleet

| Machine | Role | RAM | Services |
|---------|------|-----|----------|
| penguin-1 | SML agent | 2.7 GB | Ollama (tiny), Tailscale |
| windows-laptop | OpenClaw host | 16 GB | Ollama 7B, LiteLLM |

## License

MIT
