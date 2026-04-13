# devenv-ops

Development environment operations hub — global Copilot resources, LLM task router, fleet monitoring dashboard.

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
  skills/          (33) ──deploy──▶   skills/
  instructions/    (12) ──deploy──▶   instructions/
  agents/           (8) ──deploy──▶   agents/
  hooks/           (19) ──deploy──▶   hooks/
  scripts/global/  (17) ──deploy──▶   scripts/
```

## Quick Start

```bash
npm start              # Dashboard on :8090
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
