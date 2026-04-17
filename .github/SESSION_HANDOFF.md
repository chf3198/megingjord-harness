# Session Handoff — devenv-ops

**Created**: 2026-04-17  
**Reason**: Chat context limit reached — use this file to initialize a fresh chat.

---

## Repo Identity

- **Repo**: `chf3198/devenv-ops` at `/home/curtisfranks/devenv-ops`
- **Purpose**: Development workbench for `~/.copilot/` global Copilot resources (skills, instructions, hooks, scripts, agents). Also contains a static Alpine.js fleet monitoring dashboard.
- **Branch**: `main` (HEAD: `854eca6`)
- **No open issues** — all tickets closed as of this handoff.
- **Deploy runtime**: `~/.copilot/` — never edit directly; use `npm run deploy:apply` after merge to main.

---

## What Was Just Completed

### #137 — label-lint GitHub Actions workflow
- `.github/workflows/label-lint.yml` — enforces ADR-010 label rules on all issue events
- `skills/github-actions-security-hardening/SKILL.md` — workflow inventory table added
- `instructions/github-governance.instructions.md` — label-lint bullet added
- Merged PR #138

### #136 — Code cleanup epic (5 ACs)
- Named constants extracted: `STRESS_HARD_STOP_SEC`, `FETCH_TIMEOUT_MS`, `HEALTH_TIMEOUT_MS`, `DEDUP_WINDOW_MS`
- README: badge row + sharpened pitch; GitHub topics set
- `.nvmrc` (Node 22), `Dockerfile`, `compose.yaml`, `npm run setup`
- `dashboard/README.md`: feature-based naming convention documented
- Merged PR #139

### #140 — Wire global-task-router fleet lane (OpenClaw HTTP dispatch)
- `scripts/global/openclaw-chat.js` (new): OpenAI-compatible HTTP client for OpenClaw
  - `chatComplete(prompt, opts)` — POST `/v1/chat/completions`
  - `healthCheck()` — uses `/health/liveliness` (65ms, not the slow `/health` endpoint)
  - Direct Tailscale HTTP: `http://100.78.22.13:4000` — no SSH tunnel needed
  - 120s timeout via manual `setTimeout`+`AbortController` (NOT `AbortSignal.timeout()` — misfires in Node 22)
  - Default 256 max_tokens (phi3-mini: ~17s/50 tokens)
- `task-router-dispatch.js`: fleet lane now calls `chatComplete()` and returns live response
- `task-router-policy.json`: model ID fixed `qwen2.5:7b` → `qwen2.5-7b`
- Deployed to `~/.copilot/` via `npm run deploy:apply`
- Merged PR #141

---

## Fleet Topology

```
chromebook-2 (this machine)     penguin-1 (SML)           windows-laptop (OpenClaw)
  100.115.92.2                   100.86.248.35              100.78.22.13
  primary dev / VS Code          qwen3.5:0.8b etc.          OpenClaw LiteLLM :4000
  local=true                     Ollama :11434               Ollama :11434
```

**OpenClaw** is a LiteLLM proxy at `http://100.78.22.13:4000`. Reachable via direct Tailscale HTTP.  
Available models (from `/v1/models`): `qwen2.5-7b`, `phi3-mini`, `mistral`  
**Recommended for dispatch**: `phi3-mini` (fastest, ~6s for 5 tokens)  
**Note**: `qwen2.5-7b` inference at 256 tokens likely exceeds 120s timeout — untested; follow-up ticket recommended.

---

## Known Good Commands

```bash
npm run lint              # ≤100-line file check (235 files, all passing)
npm run router:smoke      # 3/3 classification cases pass
npm run deploy:apply      # Deploy repo → ~/.copilot/ (auto-backup)
npm run deploy            # Dry-run only

# Test fleet dispatch
node scripts/global/openclaw-chat.js --health
node scripts/global/openclaw-chat.js --prompt "your prompt" --model phi3-mini
node scripts/global/task-router-dispatch.js --prompt "implement multi-file refactor" --model phi3-mini --execute
```

---

## Architecture Constraints

- **≤100 lines per file** — hard lint gate (`npm run lint`)
- **No build step** — dashboard is static HTML/CSS/JS served by `scripts/dashboard-server.js`
- **Branch before any edit** to global resources (`skills/`, `instructions/`, `hooks/`, `scripts/global/`)
- **Git workflow**: branch → implement → lint → commit → push → PR → squash merge → delete branch → `npm run deploy:apply`
- **Ticket lifecycle**: `status:backlog` → `status:in-progress` (role:manager → role:collaborator → role:admin → role:consultant) → `status:done`

---

## Key File Locations

| What | Path |
|------|------|
| OpenClaw HTTP client | `scripts/global/openclaw-chat.js` |
| Task router dispatch | `scripts/global/task-router-dispatch.js` |
| Task router policy | `scripts/global/task-router-policy.json` |
| Lane usage log | `~/.copilot/openclaw-usage.log` |
| Global skills (source) | `skills/<name>/SKILL.md` |
| Global instructions (source) | `instructions/*.instructions.md` |
| Dashboard entry | `dashboard/index.html` |
| Dashboard JS docs | `dashboard/README.md` |
| ADRs | `research/adr/` |
| Fleet inventory | `inventory/devices.json`, `inventory/services.json` |

---

## Recommended Next Tickets

1. **Characterize per-model inference latency** on OpenClaw (`phi3-mini`, `qwen2.5-7b`, `mistral`) and add per-model timeout config to `task-router-policy.json`
2. **SLM dispatch to penguin-1** — same pattern as OpenClaw but targeting `http://100.86.248.35:11434/api/generate` (Ollama native API, not OpenAI-compat)
3. **Router smoke test expansion** — add fleet/execute path to `task-router-smoke.js` with a mock for the HTTP call
