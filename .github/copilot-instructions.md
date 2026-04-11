# Copilot Instructions — devenv-ops

**devenv-ops**: Development workbench for `~/.copilot/` global resources (v0.1.0). Skills, instructions, hooks, scripts developed here. Fleet dashboard. Research archive.

## Execution Model

Every task follows the **role baton sequence**: Manager → Collaborator → Admin → Consultant.
See `role-baton-routing` instruction for rules. Local repos may override via `.github/copilot-instructions.md`.

## Repo Purpose

This repo is the **source of truth** for all global Copilot resources:
1. **skills/** → 31 skills, deployed to `~/.copilot/skills/`
2. **instructions/** → 9 global instructions, deployed to `~/.copilot/instructions/`
3. **hooks/** → Hook scripts, deployed to `~/.copilot/hooks/`
4. **scripts/global/** → 9 bootstrap scripts, deployed to `~/.copilot/scripts/`
5. **dashboard/** → Fleet monitoring web app (Alpine.js)
6. **research/** → ADRs, service evaluations, hardware inventory
7. **inventory/** → JSON device/service state

## Architecture

```
This Repo (develop)          ~/.copilot/ (runtime)
skills/          ──deploy──▶  skills/
instructions/    ──deploy──▶  instructions/
hooks/           ──deploy──▶  hooks/
scripts/global/  ──deploy──▶  scripts/
```

**Rule**: Never edit `~/.copilot/` directly. All changes flow through this repo.

## Fleet Topology

```
penguin-1 (SML Chromebook)   windows-laptop (OpenClaw)   chromebook-2
  Ollama: tiny models          Ollama: 7B models           TBD
  2.7GB RAM                    16GB RAM
         └──────── Tailscale VPN mesh ────────┘
```

## Constraints

- **≤100 lines per file** (lint-enforced)
- **JSON for structured data** (inventory/, config)
- **Markdown for prose** (research/, ADRs, skills)
- **No build step** — dashboard is static HTML/JS/CSS
- **Branch before editing global resources**

## Commands

```bash
npm start              # Dashboard on :8090
npm run lint           # 100-line file check
npm run sync           # Pull ~/.copilot/ → repo
npm run sync:dry       # Preview sync
npm run deploy         # Preview deploy (dry-run)
npm run deploy:apply   # Deploy repo → ~/.copilot/
npm run health         # Fleet health check
npm test               # E2E tests
```

## Git Workflow

1. `git checkout -b skill/<name>` or `feat/<topic>`
2. Make changes, test behavior in Copilot Chat
3. `git checkout main && git merge feat/... --no-ff`
4. `npm run deploy:apply` after merge
5. Delete feature branch

## File Organization

| Path | Content | Format |
|---|---|---|
| `skills/<name>/SKILL.md` | Skill definition | Markdown |
| `instructions/*.instructions.md` | Global instructions | Markdown |
| `hooks/scripts/*.py` | Hook scripts | Python |
| `hooks/*.json` | Hook config | JSON |
| `scripts/global/*.js` | Bootstrap scripts | Node.js |
| `scripts/*.sh` | Sync/deploy utilities | Bash |
| `scripts/*.js` | Repo utilities | Node.js |
| `research/adr/NNN-title.md` | ADRs | Markdown |
| `inventory/*.json` | Fleet state | JSON |
| `dashboard/js/*.js` | Dashboard modules | JS |

## Environment

Chromebook dev environment. Agent has root/sudo access.
Install tools via CLI as needed. Don't ask permission.

## User Interaction Rules

- **DO consult user**: Design decisions, architecture choices
- **DO NOT ask user**: Git practices, lint fixes, test execution
- **NEVER ask user to run tests**: Agent runs all automated checks
