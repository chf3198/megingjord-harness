# Cursor worktree pattern (#3084, Epic #3083)

Cursor is a governed runtime (Phase 0). Like every concurrent agent, a Cursor session works
in a dedicated worktree + branch, never directly on the canonical `main` checkout (invariant 4).

## Create a Cursor worktree

Per ADR-012 (`research/adr/012-multi-agent-worktree-governance.md`), Cursor worktrees live under
`.harness/worktrees/cursor/`:

```bash
scripts/agent-worktree.sh cursor <issue-number> <slug>
# e.g. scripts/agent-worktree.sh cursor 3084 cursor-thin-adapter
```

This creates an isolated worktree on branch `feat/<issue>-<slug>` (or `fix/...`) and links
`node_modules` from the main checkout. Do all Cursor edits there; merge via PR.

## Deploy the Cursor adapter

```bash
npm run deploy:cursor          # dry run — shows what would deploy to ~/.cursor/
npm run deploy:cursor:apply    # rsync .cursor/ -> ~/.cursor/ and register the MCP server
```

`deploy:cursor` ships the committed `.cursor/rules/megingjord.mdc` adapter and registers the
`megingjord-xteam` MCP server in `~/.cursor/mcp.json` (the `mcpServers` key). It is additive:
your existing `~/.cursor/rules/*.mdc` and other MCP servers are preserved.

## Scope (Phase 0)

Phase 0 is registration + the static `.cursor/rules/megingjord.mdc` adapter. Runtime hook
enforcement (`.cursor/hooks.json`) and HAMR substrate activation land in Phase 1 (#3085);
subagents, visual-QA MCP, and the ticket-lifecycle gate land in Phase 2 (#3086). The Cursor
session reads the always-on governance rule but gates are not yet wired — treat the four
invariants as operator discipline until Phase 1.

## Slugs

Runtime / HAMR / adapter target / signing team value: `cursor`. GitHub assignee slug:
`cursor-team`. See `inventory/team-model-signatures.json` (`Cyrus <role-surname>` aliases).
