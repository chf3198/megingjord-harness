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

## Claude Code Runtime Install

Deploy hooks, agents, and slash commands to the Claude Code runtime:

```bash
npm run deploy:claude:apply   # .claude/ → ~/.claude/
npm run sync:claude            # ~/.claude/ → .claude/ (pull back)
```

## Constraints

- **≤100 lines** per file (lint-enforced)
- **Branch before editing**: `feat/<issue>-<slug>`
- **Conventional commits**: `feat(scope):`, `fix(scope):`
- **settings.json drift**: Permission approvals auto-append to `.claude/settings.json`. Commit these via `chore:` commit with ticket ref before branching (#506).
- Run `npm run lint` before pushing

## PR Checklist

Before submitting a pull request, verify:

- [ ] `npm run lint` passes (no new violations)
- [ ] `npm run validate:triage` passes (if skills changed)
- [ ] `npm run validate:compat` passes (if plugin.json changed)
- [ ] All new files ≤100 lines
- [ ] Conventional commit message format used

## Issue Templates

Use the appropriate template when opening issues:
- **Bug report** → `bug-report.yml`
- **Feature request** → `feature_request.md`
- **Epic** → `epic.yml`
- **Research** → `research.yml`

## Baton Gate Chain

Every PR runs `baton-gates.yml`: collaborator-gate → admin-gate → consultant-gate. Each gate
checks the PR body/comments for its artifact string — no human approval needed (#516). **PR
body must include all three**: `COLLABORATOR_HANDOFF`, `ADMIN_HANDOFF`, `CONSULTANT_CLOSEOUT`.
All sections require `Signed-by:` / `Team&Model:` / `Role:` (#485). Admin ≠ Collaborator
(#494). PRs >10 files or >500 LOC: BLOCKER_NOTE (#492). Evidence Block + CLOSEOUT (#493).

**Admin must verify before merging**: (1) `pr-title-required` green (≤60 chars); (2) all three
gates green; (3) artifact strings present in PR body. Merge with failing checks is Admin:F (#511).
