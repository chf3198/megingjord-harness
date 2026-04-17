# Contributing to devenv-ops

## Universal vs Personal Skills

Skills are categorized in `skills/.plugin-triage.json`:
- **Universal** (24): Ship in `plugin.json` for all consumers
- **Personal** (11): Deploy only via `deploy.sh` to `~/.copilot/`

## Adding a Universal Skill

1. Create `skills/<name>/SKILL.md` with YAML frontmatter
2. Add to `plugin.json` `skills` array
3. Add to `skills/.plugin-triage.json` `universal` list
4. Run `npm run validate:triage` to verify sync
5. Branch → PR → squash merge → `npm run deploy:apply`

## Adding a Personal Skill

1. Create `skills/<name>/SKILL.md`
2. Add to `skills/.plugin-triage.json` `personal` list
3. Do NOT add to `plugin.json`
4. Run `npm run validate:triage`

## Skill Format

```markdown
---
name: skill-name
description: One-line description
---
# skill-name — Title
## Purpose
## Scope
## Constraints
## Instructions
## Verification
```

## Testing Plugin Installation

1. Push changes to a branch
2. In VS Code: `Chat: Install Plugin From Source`
3. Paste the branch Git URL
4. Verify skills appear in chat suggestions

## Cross-Tool Compatibility

| Tool | Detection Path |
|------|---------------|
| VS Code Copilot | `plugin.json` (root) |
| Claude Code | `.claude-plugin/plugin.json` (symlink) |
| GitHub Copilot | `.github/plugin/plugin.json` (symlink) |

Symlinks auto-resolve to root `plugin.json`.

## Constraints

- **≤100 lines** per file (lint-enforced)
- **Branch before editing**: `feat/<issue>-<slug>`
- **Conventional commits**: `feat(scope):`, `fix(scope):`
- Run `npm run lint` before pushing
