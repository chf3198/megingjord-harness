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

## Scope (Phase 0 → Phase 1 → Phase 2)

Phase 0 (#3084) was registration + the static `.cursor/rules/megingjord.mdc` adapter.

Phase 1 (#3085) wires runtime enforcement:

- **Hooks** — `.cursor/hooks.json` (regenerate with `npm run cursor:hooks-emit`) maps the
  Cursor camelCase events onto the harness hook scripts via `scripts/global/cursor-hooks-emit.js`.
  `deploy:cursor:apply` deploys the hook scripts to `~/.cursor/hooks/`.
- **HAMR** — `HAMR_TEAM=cursor` is recognized by `hamr-activate.sh` (writes `~/.cursor/hamr-config.json`),
  `hamr_activation_check.py` (sessionStart advisory), and `hamr-provider-wrapper.js` (config-path lookup).
  Cursor activates with `HAMR_TEAM=cursor npm run hamr:activate` (provider-neutral default).

Phase 2 (#3086) completes the #1912 twelve-surface parity:

- **Ticket-lifecycle gates** — the EVENT_MAP now wires all nine requiredHookScripts:
  `manager_ticket_gate.py` + `goal_lens.py` on `beforeSubmitPrompt`, and `commit_ticket_gate.py`
  on `preToolUse`/`beforeShellExecution` (alongside `pretool_guard.py`).
- **Agents/subagents** — `deploy:cursor:apply` deploys `agents/` → `~/.cursor/agents/`; the
  Cursor-native `subagentStart`/`subagentStop` events are wired (Phase 1).
- **Visual QA** — the governance gate is runtime-agnostic (`pretool_guard.py` blocks `git tag`
  when UI is touched without recorded `visual_qa`; `stop_checks.py` includes it) and is already
  deployed to `~/.cursor/hooks/`; the `playwright-vision-low-resource` skill reaches Cursor via
  the shared skills dirs. Playwright MCP itself is operator-configured identically across all
  runtimes (none auto-register it).
- **Wiki** — Cursor reads `~/.copilot/wiki/` cross-runtime via `wiki-knowledge.instructions.md`
  (mirror Claude Code). See the full surface table in `docs/architecture-runtime-parity.md`.

## Slugs

Runtime / HAMR / adapter target / signing team value: `cursor`. GitHub assignee slug:
`cursor-team`. See `inventory/team-model-signatures.json` (`Cyrus <role-surname>` aliases).
