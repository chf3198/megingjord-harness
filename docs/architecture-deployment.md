# Architecture — Deployment Model

## Two-layer deployment

Megingjord operates two independent layers per machine. All changes flow from
this repo (source of truth) outward to runtime targets — never the reverse.

```
This Repo (main)                   Runtime targets
────────────────────               ──────────────────────────────────────
skills/          ──deploy──▶  ~/.copilot/skills/  +  ~/.agents/skills/
instructions/    ──deploy──▶  ~/.copilot/instructions/
hooks/           ──deploy──▶  ~/.copilot/hooks/   +  ~/.codex/devenv-ops/hooks/
scripts/global/  ──deploy──▶  ~/.copilot/scripts/ +  ~/.codex/devenv-ops/scripts/
.codex/          ──deploy──▶  ~/.codex/ (AGENTS.md, config.toml, hooks.json, rules/)
agents/          ──deploy──▶  ~/.copilot/agents/
wiki/            ──deploy──▶  ~/.copilot/wiki/
dashboard/       ──deploy──▶  ~/.copilot/dashboard/ (static)
```

**Global layer** (`~/.copilot/`, `~/.claude/`, `~/.codex/`): installed once per
machine; shared by all developer repositories on that machine.

**Workspace layer** (each project repo root): `.github/copilot-instructions.md`,
`CLAUDE.md`, `AGENTS.md`, `.claude/settings.json` — committed into each project
and override/extend the global layer for that project only.

## Deploy commands

| Command | Effect |
|---|---|
| `npm run deploy:apply` | Repo → `~/.copilot/` |
| `npm run deploy:codex:apply` | Repo → `~/.codex/` |
| `npm run deploy:claude:apply` | Repo → `~/.claude/` |
| `npm run deploy:both:apply` | Repo → Copilot + Codex |
| `npm run sync` | `~/.copilot/` → repo (pull back) |
| `npm run sync:codex` | `~/.codex/` → repo (pull back) |
| `npm run sync:claude` | `~/.claude/` → repo (pull back) |

**Invariant**: never edit `~/.copilot/`, `~/.codex/`, or `~/.claude/` directly.
All changes flow through this repo. Direct edits are silently overwritten on the
next `deploy:apply` run.

## Layer-2 coordination — HAMR vs GitHub-native

Two backends for cross-agent coordination; selected by `MEGINGJORD_HAMR_ENABLED`:

| `MEGINGJORD_HAMR_ENABLED` | Backend | External infra required |
|---|---|---|
| unset / `0` (default) | GitHub-native client | GitHub repo access only |
| `1` | HAMR Cloudflare Worker | Cloudflare account + secrets |

GitHub-native primitives (default — zero external infrastructure):

| Primitive | Script | Mechanism |
|---|---|---|
| Mailbox | `github-mailbox.js` | GitHub Issues comment thread + ETag polling |
| Bundle distribution | `github-bundle-client.js` | GitHub Releases assets |
| MCP dispatch | `github-mcp-dispatch.js` | `repository_dispatch` event |
| Telemetry | `github-telemetry-read.js` | Actions artifact (6h scheduled upload) |
| Substrate health | `github-substrate-health-read.js` | Actions artifact upload |

The unified client `scripts/global/github-native-client.js` auto-selects backend
based on the env var. See [`docs/howto/github-native-layer2.md`](howto/github-native-layer2.md).

## Multi-runtime parity

A single governance manifest drives all three runtimes:

```
inventory/governance-manifest.json
    │
    ├─▶ .github/copilot-instructions.md  (GitHub Copilot)
    ├─▶ CLAUDE.md                        (Claude Code)
    └─▶ AGENTS.md                        (Codex)
```

`npm run governance:adapters:emit` regenerates runtime-specific shims from the
central manifest. See [`docs/architecture-runtime-parity.md`](architecture-runtime-parity.md).

## Related documents

- [`ARCHITECTURE.md`](../ARCHITECTURE.md) — executive overview and document map
- [`docs/architecture-layer-model.md`](architecture-layer-model.md) — layer topology detail
- [`docs/howto/installation.md`](howto/installation.md) — install walkthrough
- [`docs/howto/sandbox-worktree-governance.md`](howto/sandbox-worktree-governance.md) — worktree lifecycle
