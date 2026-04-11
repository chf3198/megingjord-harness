# devenv-ops

Development environment operations: versioned skills, infrastructure research, and monitoring dashboard.

## What This Repo Does

1. **Skills as Code** — Global Copilot skills/instructions/hooks tracked in git with branch→test→merge→deploy workflow
2. **Research Archive** — Infrastructure research, free-tier inventories, hardware evaluations, architecture decisions
3. **Environment Dashboard** — Web app monitoring health of local Ollama instances, OpenClaw gateway, free-tier API quotas, and Tailscale mesh
4. **Device Inventory** — Structured data describing all machines, models, services, and costs

## Architecture

```
┌─────────────────────────────────────────────────┐
│  devenv-ops repo (this)                         │
│  ├─ skills/        → versioned skill sources    │
│  ├─ research/      → decisions & evaluations    │
│  ├─ inventory/     → fleet state (JSON)         │
│  └─ dashboard/     → monitoring web app         │
└──────────┬──────────────────────────────────────┘
           │ deploy (scripts/deploy-skills.sh)
           ▼
┌─────────────────────────────────────────────────┐
│  ~/.copilot/skills/  (machine-local runtime)    │
│  Machine: penguin-1 (SML Chromebook)            │
│  Machine: windows-laptop (OpenClaw host)        │
│  Machine: chromebook-2                          │
└─────────────────────────────────────────────────┘
```

## Quick Start

```bash
npm install           # Install dependencies
npm start             # Serve dashboard on :8090
npm run lint          # Lint all files (100-line max)
npm run sync:skills   # Pull current ~/.copilot/skills/ into skills/
npm run deploy:skills # Push skills/ to ~/.copilot/skills/
npm run health        # Run fleet health check
npm test              # Run tests
```

## Folder Structure

| Folder | Purpose |
|---|---|
| `skills/` | Versioned copies of global Copilot skills |
| `instructions/` | Versioned global instruction files |
| `hooks/` | Git hooks and deployment automation |
| `research/` | Infrastructure research and ADRs |
| `inventory/` | Device specs, service configs (JSON) |
| `dashboard/` | Alpine.js monitoring web app |
| `scripts/` | Sync, deploy, health-check utilities |
| `tests/` | Playwright E2E + unit tests |

## Subscriptions & Budget

| Service | Cost | Value |
|---|---|---|
| GitHub Copilot Pro | $10/mo | 300 premium req/mo, frontier models, agent mode |
| Cloudflare Workers | $10/mo | Pages, Workers AI (10K neurons/day free), D1 |
| OpenRouter | $0 | Free models only |
| Google AI Studio | $0 | Free-tier Gemini 2.5 Pro/Flash, vision, grounding |
| Groq | $0 | Free-tier fast inference, rate-limited |
| Cerebras | $0 | Free-tier ultra-fast inference |

## Hardware Fleet

| Machine | Role | RAM | Key Services |
|---|---|---|---|
| penguin-1 (Chromebook) | SML agent | 2.7GB | Ollama (tiny models), Tailscale |
| windows-laptop | OpenClaw host | 16GB | Ollama (7B models), OpenClaw gateway |
| chromebook-2 | Dev/staging | TBD | Tailscale, browser dev |

## License

MIT
