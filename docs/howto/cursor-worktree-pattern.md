# Cursor worktree pattern (#3084, Epic #3083)

Cursor is a governed runtime (Phase 0). Like every concurrent agent, a Cursor session works
in a dedicated worktree + branch, never directly on the canonical `main` checkout (invariant 4).

## Create a Cursor worktree

Per ADR-012 as amended by #3088, Cursor (a dedicated-IDE runtime) gets a STANDING SIBLING worktree
`devenv-ops-cursor` on a `sandbox/cursor` branch — the workspace root Cursor's IDE opens:

```bash
scripts/agent-worktree.sh cursor      # or: npm run runtime:worktree -- cursor
```

The command takes a single `<vendor>` argument (no issue/slug — that was a stale 3-arg form in the
earlier draft; flagged in Phase-0 UAT). It creates `devenv-ops-cursor [sandbox/cursor]`, works when
run from the main checkout (it does NOT reuse the already-checked-out `main` branch), and provisions
the worktree via `scripts/global/worktree-provision.js` — symlinking `node_modules` AND `.env` from
the main checkout (per `config/worktree-provisioning.json`) so HAMR/provider calls find their keys.
Do per-ticket Cursor work on `feat/<issue>-<slug>` branches inside that standing worktree; merge via PR.

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
