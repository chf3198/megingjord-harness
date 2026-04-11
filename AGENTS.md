# AGENTS.md — devenv-ops baseline

## Agent startup protocol (required)

1. Load `.github/copilot-instructions.md` before planning edits.
2. Global skills, instructions, and hooks in this repo are the **development source**.
3. `~/.copilot/` is the **deployed runtime**. Never edit runtime directly.
4. Validate changes with lint and tests before claiming completion.

## Repo purpose

This repo is the **development workbench** for the entire `~/.copilot/` system:
- `skills/` → develop and test skill changes here, deploy to `~/.copilot/skills/`
- `instructions/` → develop global instructions here, deploy to `~/.copilot/instructions/`
- `hooks/` → develop hooks here, deploy to `~/.copilot/hooks/`
- `scripts/global/` → develop scripts here, deploy to `~/.copilot/scripts/`
- `dashboard/` is a standalone web app — treat with full web-app rigor.
- `research/` docs are living — update when new services or hardware are evaluated.

## Edit discipline

- Keep changes minimal and localized.
- ≤100 lines per file (lint-enforced).
- JSON for structured data (inventory/, config).
- Markdown for prose (research/, ADRs).
- **Branch before editing global resources**: `git checkout -b skill/<name>` or `feat/<topic>`
- **Test before deploying**: verify agent behavior in a test chat session.

## Development → Deploy workflow

```
1. Branch:  git checkout -b skill/<name>-change
2. Edit:    skills/<name>/SKILL.md (or instructions/, hooks/)
3. Test:    Verify behavior in Copilot Chat
4. Merge:   git checkout main && git merge --no-ff
5. Deploy:  npm run deploy:apply
```

## Dashboard conventions

- Alpine.js for state, vanilla JS for logic
- No build step — static files served directly
- Cloudflare Pages for production deployment
