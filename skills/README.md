# Skills Directory

Versioned copies of global Copilot skills from `~/.copilot/skills/`.

## Workflow

```bash
# Pull current skills from machine into this repo
npm run sync:skills

# After editing and merging, push back to machine
npm run deploy:skills
```

## Structure

Each skill is a folder containing at minimum `SKILL.md`:

```
skills/
  repo-standards-router/
    SKILL.md
  openclaw-universal-system/
    SKILL.md
  ...
```

## Sync Status

Run `npm run sync:skills` to populate this directory from your
current `~/.copilot/skills/` installation.
