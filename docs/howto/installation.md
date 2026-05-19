# Installing the Megingjord Harness

## Prerequisites

- Node >= 22, Git, GitHub CLI (`gh`)
- VS Code with at least one of: GitHub Copilot Chat, Claude Code, or Codex

## Install on a new machine

```bash
git clone https://github.com/chf3198/megingjord-harness.git
cd megingjord-harness
npm install
npm run deploy:both:apply   # seeds ~/.copilot/ + ~/.claude/ + ~/.codex/
```

After this, every project on the machine inherits the global governance
layer — skills, routing, hooks, wiki, and instructions — for all three runtimes.

## Initialize a project workspace

From inside any project repo (not the harness repo itself):

1. Copy the workspace adapter files into the project:

   ```bash
   cp /path/to/megingjord-harness/.github/copilot-instructions.md .github/
   cp /path/to/megingjord-harness/CLAUDE.md .
   cp /path/to/megingjord-harness/AGENTS.md .
   cp -r /path/to/megingjord-harness/.claude .
   ```

2. Customize each adapter file to reflect the project's purpose.
3. Commit the workspace files to the project repo.

The global layer is already live — no further setup needed for Copilot, Claude
Code, or Codex to pick up the harness skills and governance hooks.

## Two-layer model

```
Machine global layer                     Project workspace layer
─────────────────────────────────        ──────────────────────────────
~/.copilot/skills/                       .github/copilot-instructions.md
~/.copilot/instructions/                 CLAUDE.md + .claude/settings.json
~/.copilot/hooks/scripts/                AGENTS.md + .codex/
~/.claude/agents/ + commands/            (workspace-specific wiki, overrides)
~/.codex/AGENTS.md + config/

Deployed once, shared by all projects    Unique per project, committed to git
```

## Adding a second project

Run the workspace initialization steps in the new repo. The global layer is
already in place — `npm run deploy:apply` is idempotent and safe to re-run
to pick up harness updates in existing projects.

## Workspace overrides

Each workspace file can override global behavior for its extension:

- **Copilot**: add rules to `.github/copilot-instructions.md`
- **Claude Code**: add to `CLAUDE.md` or `.claude/settings.json`
- **Codex**: add to `AGENTS.md` or `.codex/`

Local wins on conflict per the provider-neutral governance contract.

## Updating the harness

```bash
cd megingjord-harness && git pull
npm run deploy:both:apply   # re-deploys global layer; idempotent
```

All projects sharing the machine automatically get the update.

## Workspace wiki

Each project can maintain its own `wiki/` source that compiles into
`~/.copilot/wiki/`. Run `npm run wiki:ingest` from the harness repo after
copying updated source to refresh the compiled wiki.
