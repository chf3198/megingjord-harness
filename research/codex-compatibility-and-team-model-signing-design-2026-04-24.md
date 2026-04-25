# Codex Compatibility and Team&Model Signing Design — 2026-04-24

## Goal

One DevEnv Ops init path should install a governance-first harness for Copilot, Claude Code, and Codex.

## Verified Codex surfaces

- `$CODEX_HOME/AGENTS.md` and `AGENTS.override.md` for global instructions.
- Repo-tree `AGENTS.md` files plus `project_doc_fallback_filenames` for local overrides.
- `~/.agents/skills/` for user-level reusable skills.
- `~/.codex/config.toml` plus trusted repo `.codex/config.toml` for config layers.
- `~/.codex/hooks.json` / repo `.codex/hooks.json` for native hooks.
- `~/.codex/rules/` / repo `.codex/rules/` for native command rules.
- Plugins/MCP as tool extensions, with `.codex-plugin/plugin.json` as the local plugin manifest format.

## Runtime mapping

| Concern | Copilot | Claude Code | Codex |
|---|---|---|---|
| Global baseline | `~/.copilot/instructions/` | `CLAUDE.md` + deployed hooks | `$CODEX_HOME/AGENTS.md` + `config.toml` |
| Reusable skills | `~/.copilot/skills/` | `.claude/commands/` | `~/.agents/skills/` |
| Agents/subagents | `~/.copilot/agents/` | `.claude/agents/` | Codex subagents/future mapping |
| Tool integration | hooks + scripts | `.claude/settings.json` hooks | `hooks.json`, `rules/`, MCP, plugins, config |
| Repo override | `.github/copilot-instructions.md` | `CLAUDE.md` + repo files | repo `AGENTS.md` |

## Codex init contract

1. Install or merge the global baseline into `$CODEX_HOME/AGENTS.md`.
2. Sync shared skills into `~/.agents/skills/`.
3. Merge Codex MCP/config entries into `~/.codex/config.toml`.
4. Install user-level hooks and rules into `~/.codex/hooks.json` and `~/.codex/rules/`.
5. Keep managed support assets namespaced under `~/.codex/devenv-ops/`.
6. Keep ticket, PR, and git governance in the repo, not in the home directory.

## Precedence

1. Global DevEnv Ops baseline
2. Runtime-specific global config
3. Repo-local governance
4. Deeper repo-local override

Repo-local rules may narrow or extend the baseline, but must keep issue linkage, role baton evidence, and Team&Model provenance.

## Team&Model signing

Required fields:
- `Signed-by`
- `Team&Model`
- `Role`
- `Device` when non-local or fleet-hosted

Canonical format:
- `Team&Model: <team>:<model>@<substrate>[/<device>]`

Examples:
- `codex:gpt-5.4@local`
- `copilot:claude-sonnet-4.6@github-copilot`
- `fleet:mistral@openclaw/windows-laptop`

## Implementation status after #468

- Deploy/sync target `~/.agents/skills/`, `~/.codex/config.toml`, `~/.codex/hooks.json`, `~/.codex/rules/`, and namespaced support assets under `~/.codex/devenv-ops/`.
- Shared governance hooks resolve runtime-sensitive state, wiki, task-router, and repo-scope paths for Codex as well as Copilot.
- Repo docs and command surfaces expose Codex deploy/sync flows as first-class operations.
- Plugin packaging remains a future enhancement, but the installer now uses currently documented Codex-native surfaces directly.
