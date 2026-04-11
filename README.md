# devenv-ops

Development environment operations: global Copilot resources developed here, deployed to `~/.copilot/` on any machine.

## What This Repo Does

1. **Global Resources as Code** — Skills, instructions, hooks, and scripts developed with branch→test→merge→deploy workflow
2. **Research Archive** — Free-tier inventories, hardware evaluations, architecture decisions (ADRs)
3. **Environment Dashboard** — Web app monitoring Ollama, OpenClaw, API quotas, Tailscale mesh
4. **Device Inventory** — Structured JSON of machines, models, services, and costs

## Architecture

```
devenv-ops (this repo — development source)
  ├─ skills/          31 Copilot skill definitions
  ├─ instructions/     9 global instruction files
  ├─ hooks/            Hook scripts + config
  ├─ scripts/global/   9 bootstrap/preflight scripts
  ├─ dashboard/        Fleet monitoring web app
  ├─ research/         ADRs + evaluations
  └─ inventory/        Device/service JSON
          │
          │  npm run deploy:apply
          ▼
~/.copilot/ (machine-local runtime)
  ├─ skills/          ← VS Code Copilot reads from here
  ├─ instructions/    ← Global instruction layer
  ├─ hooks/           ← Runtime hooks
  └─ scripts/         ← Bootstrap utilities
```

## Quick Start

```bash
npm install                # Install dependencies
npm start                  # Serve dashboard on :8090
npm run lint               # 100-line file check
npm run sync               # Pull ~/.copilot/ → repo (refresh dev copies)
npm run sync:dry           # Preview sync without changes
npm run deploy             # Preview what would deploy (dry-run)
npm run deploy:apply       # Deploy repo → ~/.copilot/ (with backup)
npm run health             # Fleet health check
npm test                   # E2E tests
```

## Folder Structure

| Folder | Purpose |
|---|---|
| `skills/` | Dev copies of global Copilot skills (31) |
| `instructions/` | Dev copies of global instruction files (9) |
| `hooks/` | Dev copies of global hooks |
| `scripts/global/` | Dev copies of bootstrap/preflight scripts (9) |
| `scripts/` | Repo utilities: sync, deploy, lint, health-check |
| `dashboard/` | Alpine.js fleet monitoring web app |
| `research/` | Infrastructure research and ADRs |
| `inventory/` | Device specs, service configs (JSON) |

## Subscriptions & Budget

| Service | Cost | Value |
|---|---|---|
| GitHub Copilot Pro | $10/mo | 300 premium req, agent mode |
| Cloudflare Workers | $10/mo | Pages, Workers AI, D1 |
| Google AI Studio | $0 | Gemini 2.5 Pro/Flash, vision |
| Groq | $0 | Fast inference, rate-limited |
| Cerebras | $0 | Ultra-fast inference |
| OpenRouter | $0 | Free models only |

## Hardware Fleet

| Machine | Role | RAM | Key Services |
|---|---|---|---|
| penguin-1 | SML agent | 2.7GB | Ollama (tiny), Tailscale |
| windows-laptop | OpenClaw host | 16GB | Ollama (7B), OpenClaw |
| chromebook-2 | Dev/staging | TBD | Tailscale |

## License

MIT
