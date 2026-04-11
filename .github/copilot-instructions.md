# Copilot Instructions — devenv-ops

**devenv-ops**: Development environment operations hub (v0.1.0). Skills versioning, fleet monitoring dashboard, infrastructure research. Alpine.js frontend + static deployment.

## The Loop (execute on every task)

```
DESIGN → TEST → CODE → VERIFY → REFLECT → COMMIT
```

## Repo Purpose

This repo manages the **meta-layer** of our development environment:
1. **Skills** — Copilot agent skills versioned as code with deploy pipeline
2. **Dashboard** — Alpine.js web app monitoring fleet health and quotas
3. **Research** — Living docs tracking free-tier services, hardware, architecture
4. **Inventory** — JSON-structured fleet state (devices, models, services)

## Architecture

### Three Concern Areas

```
Skills Layer (skills/, instructions/, hooks/)
  ├─ Versioned skill sources (SKILL.md per skill)
  ├─ Sync: pull from ~/.copilot/skills/ into repo
  └─ Deploy: push from repo to ~/.copilot/skills/

Dashboard (dashboard/)
  ├─ Alpine.js frontend — monitors fleet health
  ├─ Checks: Ollama instances, OpenClaw, API quotas
  └─ Deploy: Cloudflare Pages (static)

Research & Inventory (research/, inventory/)
  ├─ ADRs for infrastructure decisions
  ├─ Free-tier service evaluations
  └─ JSON inventory of devices and services
```

### Fleet Topology

```
penguin-1 (SML)          windows-laptop (OpenClaw)     chromebook-2
  Ollama: tiny models      Ollama: 7B models            Dev/staging
  Tailscale mesh           OpenClaw gateway              Tailscale mesh
  2.7GB RAM                16GB RAM                      TBD
       └──────── Tailscale VPN mesh ────────┘
```

## Constraints

- **≤100 lines per file** (lint-enforced, no exceptions)
- **JSON for structured data** (inventory, config)
- **Markdown for prose** (research, ADRs, skill docs)
- **No build step** — dashboard is static HTML/JS/CSS
- **Test skill changes on a branch** before deploying

## Commands

```bash
npm start             # Dashboard on :8090
npm run lint          # 100-line file check
npm run sync:skills   # Pull skills from ~/.copilot/skills/
npm run deploy:skills # Push skills to ~/.copilot/skills/
npm run health        # Fleet health check
npm test              # E2E tests
```

## Git Workflow

1. `git checkout -b feat/description` or `skill/skill-name`
2. Make changes, test
3. `git checkout main && git merge feat/... --no-ff`
4. Delete feature branch after merge

## File Organization

| Path | Content | Format |
|---|---|---|
| `skills/<name>/SKILL.md` | Skill definition | Markdown |
| `research/adr/NNN-title.md` | Architecture decision | Markdown |
| `research/*.md` | Evaluation docs | Markdown |
| `inventory/devices.json` | Machine specs | JSON |
| `inventory/services.json` | API service config | JSON |
| `dashboard/js/*.js` | Dashboard modules | ES modules |
| `scripts/*.js` | Node.js utilities | CommonJS |
| `scripts/*.sh` | Shell utilities | Bash |

## Environment

Chromebook dev environment. Agent has root/sudo access.
Install tools via CLI as needed. Don't ask permission.

## User Interaction Rules

- **DO consult user**: Design decisions, architecture choices
- **DO NOT ask user**: Git practices, lint fixes, test execution
- **NEVER ask user to run tests**: Agent runs all automated checks
