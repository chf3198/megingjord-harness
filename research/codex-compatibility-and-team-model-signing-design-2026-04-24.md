# Codex Compatibility and Team&Model Signing Design — 2026-04-24

## Goal

One DevEnv Ops init path should install a governance-first harness for Copilot, Claude Code, and Codex.

## Verified Codex surfaces

- `$CODEX_HOME/AGENTS.md` and `AGENTS.override.md` for global instructions.
- Repo-tree `AGENTS.md` files for local overrides.
- `$CODEX_HOME/skills/` for reusable skills.
- `~/.codex/config.toml` for model instructions, MCP, and extra tools.
- Plugins/MCP as tool extensions.
- Codex docs also expose Rules and Hooks as configuration areas; treat them as later installer targets once stable file paths are confirmed.

## Runtime mapping

| Concern | Copilot | Claude Code | Codex |
|---|---|---|---|
| Global baseline | `~/.copilot/instructions/` | `CLAUDE.md` + deployed hooks | `$CODEX_HOME/AGENTS.md` + `config.toml` |
| Reusable skills | `~/.copilot/skills/` | `.claude/commands/` | `$CODEX_HOME/skills/` |
| Agents/subagents | `~/.copilot/agents/` | `.claude/agents/` | Codex subagents/future mapping |
| Tool integration | hooks + scripts | `.claude/settings.json` hooks | MCP/plugins/config |
| Repo override | `.github/copilot-instructions.md` | `CLAUDE.md` + repo files | repo `AGENTS.md` |

## Codex init contract

1. Install or merge the global baseline into `$CODEX_HOME/AGENTS.md`.
2. Sync shared skills into `$CODEX_HOME/skills/`.
3. Merge Codex MCP/config entries into `~/.codex/config.toml`.
4. Create or update repo `AGENTS.md` with repo-local governance overlays.
5. Keep ticket, PR, and git governance in the repo, not in the home directory.

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

## Human alias convention

- Human alias is display-friendly; structured provenance is source of truth.
- Given name derives from team + model family.
- Surname derives from Agile role.
- Role surnames: Manager=`Mason`, Collaborator=`Harper`, Admin=`Reyes`, Consultant=`Vale`.
- Example: `Quill Mason | codex:gpt-5.4@local | role:manager`

## Required signing surfaces

- GitHub baton artifacts and exception notes
- PR descriptions and review/closeout evidence
- AI-authored governance/design docs
- AI-authored commits via trailers when the toolchain permits

## Git trailer contract

- `AI-Signature: <human-alias>`
- `AI-Team-Model: <team>:<model>@<substrate>[/<device>]`
- `AI-Role: <role>`

## Implementation next steps

- Extend deploy/sync to manage Codex home targets.
- Add repo-init scaffolding for Codex-aware `AGENTS.md`.
- Add helpers or hooks that stamp commit/PR trailers and bodies.
- Keep signing rules global, but let repos add stricter local variants.
