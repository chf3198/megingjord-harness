# Session Handoff — devenv-ops

**Created**: 2026-04-17  
**Reason**: Chat context limit reached — use this file to initialize a fresh chat.

---

## Repo Identity

- **Repo**: `chf3198/devenv-ops`
- **Purpose**: Development workbench for `~/.copilot/` global Copilot resources
- **Branch**: `main`
- **Deploy runtime**: `~/.copilot/` — never edit directly; use `npm run deploy:apply`

## What Was Just Completed

### #137 — label-lint GitHub Actions workflow
- `.github/workflows/label-lint.yml` — enforces ADR-010 label rules
- Merged PR #138

### #136 — Code cleanup epic (5 ACs)
- Named constants, README badges, `.nvmrc`, `Dockerfile`, `compose.yaml`
- Merged PR #139

### #140 — Wire global-task-router fleet lane (OpenClaw HTTP dispatch)
- `scripts/global/openclaw-chat.js`: OpenAI-compatible HTTP client for OpenClaw
  - Uses `fleet-config.js` `getOpenClawURL()` for dynamic IP resolution
  - 120s timeout via `setTimeout`+`AbortController` (not `AbortSignal.timeout()`)
- `task-router-dispatch.js`: fleet lane calls `chatComplete()` with live response
- Merged PR #141

## Fleet Topology

IPs resolved dynamically via `scripts/global/fleet-config.js` (Tailscale auto-detect + env overrides). Run `node scripts/global/fleet-config.js profile` for current state.

**OpenClaw**: LiteLLM proxy on `windows-laptop:4000`. Use `getOpenClawURL()`.  
Models: `qwen2.5-7b`, `phi3-mini`, `mistral`. Recommended: `phi3-mini` (~6s/5 tokens).

## Known Good Commands

```bash
npm run lint              # ≤100-line file check
npm run router:smoke      # 3/3 classification cases pass
npm run deploy:apply      # Deploy repo → ~/.copilot/
node scripts/global/openclaw-chat.js --health
node scripts/global/task-router-dispatch.js --prompt "test" --model phi3-mini --execute
```

## Architecture Constraints

- **≤100 lines per file** — hard lint gate
- **No build step** — static HTML/CSS/JS dashboard
- **Branch before editing** global resources
- **Git**: branch → implement → lint → PR → squash merge → deploy

## Key File Locations

| What | Path |
|------|------|
| Fleet config (IP resolution) | `scripts/global/fleet-config.js` |
| OpenClaw HTTP client | `scripts/global/openclaw-chat.js` |
| Task router dispatch | `scripts/global/task-router-dispatch.js` |
| Global skills (source) | `skills/<name>/SKILL.md` |
| Dashboard entry | `dashboard/index.html` |
| Fleet inventory | `inventory/devices.json` |

## Recommended Next Tickets

1. Characterize per-model inference latency and add per-model timeout config
2. SML dispatch to penguin-1 via Ollama native API
3. Router smoke test expansion with fleet/execute mock
