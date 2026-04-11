---
applyTo: "skills/**"
---

# Skills Development Instructions

## Skill File Structure

Each skill lives in `skills/<skill-name>/SKILL.md`.

## Editing Skills

1. Branch: `git checkout -b skill/<name>-change`
2. Edit the SKILL.md file
3. Test in a Copilot Chat session to verify behavior
4. Merge to main after validation
5. Deploy: `npm run deploy:skills`

## Skill Format

Every SKILL.md must contain:
- **Name** — Short identifier
- **Description** — One-line purpose
- **When to use** — Trigger conditions
- **Instructions** — The actual skill content
- **Verification** — How to confirm it worked

## Deploy Safety

- Never deploy directly from an unmerged branch
- Always diff before deploy: `diff -r skills/ ~/.copilot/skills/`
- Keep a backup: deploy script creates timestamped backup
