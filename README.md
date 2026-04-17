# devenv-ops

[![License: PolyForm Noncommercial](https://img.shields.io/badge/License-PolyForm%20NC%201.0-purple.svg)](LICENSE)
[![Agent Plugin](https://img.shields.io/badge/Agent%20Plugin-24%20skills-blue.svg)](plugin.json)
[![Node ≥22](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](https://nodejs.org)

**AI agent governance harness — skills, agents, hooks, and wiki.**

Install as a VS Code Agent Plugin to get 24 governance skills,
8 custom agents, and wiki seed content. No build step required.

## Install as Agent Plugin

In VS Code (with Copilot), run:
> `Chat: Install Plugin From Source` → paste this repo's Git URL.

Works in VS Code, Copilot CLI, and Claude Code.

## What You Get

| Category | Count | Examples |
|----------|-------|---------|
| **Skills** | 24 | Role baton orchestration, GitHub governance, secret prevention, drift detection |
| **Agents** | 8 | @architect, @implementer, @quick, @planner, @router, @governance-auditor |
| **Wiki** | 15 seed articles | Agent drift, baton protocol, self-annealing, wiki pattern |
| **Hooks** | 19 | Global standards enforcement, repo scoping |

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

## Develop the Harness

```bash
npm run setup          # Install deps
npm start              # Dashboard on :8090
npm run deploy:apply   # Deploy repo → ~/.copilot/
npm run lint           # ≤100-line file check
npm test               # Playwright E2E tests
```

## Enable for Other Repos

```bash
npm run repo:scope -- enable /path/to/repo
npm run repo:scope -- disable /path/to/repo
npm run repo:scope -- list
```

## Help

- [Bug reports](https://github.com/chf3198/devenv-ops/issues/new?template=bug-report.yml)
- [Feature requests](https://github.com/chf3198/devenv-ops/issues/new?template=feature_request.md)
- [Support guide](SUPPORT.md) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)

## License

[PolyForm Noncommercial 1.0.0](LICENSE) — free for personal,
educational, nonprofit, and government use. Commercial use
requires explicit permission.
