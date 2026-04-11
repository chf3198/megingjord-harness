# AGENTS.md — devenv-ops baseline

## Agent startup protocol (required)

1. Load `.github/copilot-instructions.md` before planning edits.
2. Use skills from `skills/` as the canonical versioned skill layer.
3. Validate changes with lint and tests before claiming completion.

## Repo purpose

This repo governs the **development environment itself**:
- Skills, instructions, and hooks are **code** — branch, test, merge, deploy.
- The dashboard is a **product** — treat UI changes with the same rigor as any web app.
- Research docs are **living** — update when new services or hardware are evaluated.

## Edit discipline

- Keep changes minimal and localized.
- ≤100 lines per file (lint-enforced).
- Prefer JSON for structured data (inventory/, config).
- Prefer Markdown for prose (research/, ADRs).
- Test skill changes on a branch before deploying to ~/.copilot/skills/.

## Skill deployment workflow

```
1. Edit skill in skills/<name>/SKILL.md
2. Branch: git checkout -b skill/<name>-change
3. Test: verify agent behavior in a test chat
4. Merge: git merge --no-ff
5. Deploy: npm run deploy:skills
```

## Dashboard conventions

- Alpine.js for state, vanilla JS for logic
- No build step — static files served directly
- Cloudflare Pages for production deployment
- Mobile-responsive (development often happens on Chromebooks)
