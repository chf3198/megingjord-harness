# Cursor — #1912 twelve-surface governance parity matrix

Cursor is the 5th governed runtime (Phase 0 #3084, Phase 1 #3085, Phase 2 #3086,
Epic #3083). Status against the twelve `orchestrator-governance-parity.json`
`canonicalSurfaces`:

| # | Surface | Cursor status | Mechanism |
| --- | --- | --- | --- |
| 1 | instructions | ✅ | `.cursor/rules/megingjord.mdc` (alwaysApply) |
| 2 | skills_or_commands | ✅ | shared `~/.agents/skills/` + `~/.copilot/skills/` |
| 3 | agents_or_subagents | ✅ | `agents/` → `~/.cursor/agents/`; `subagentStart`/`subagentStop` hooks |
| 4 | hooks_or_gates | ✅ | `.cursor/hooks.json` via `cursor-hooks-emit.js` (all 9 requiredHookScripts) |
| 5 | state_store | ✅ | `state_store.py` keyed by cwd (per-worktree); runtime-agnostic |
| 6 | deploy_sync | ✅ | `deploy:cursor:apply` (`.cursor/` + hooks + agents → `~/.cursor/`) |
| 7 | hamr_routing | ✅ | `HAMR_TEAM=cursor` (provider-wrapper, activation-check, activate.sh) |
| 8 | ticket_lifecycle | ✅ | `manager_ticket_gate`/`goal_lens` (beforeSubmitPrompt) + `commit_ticket_gate` (preToolUse) |
| 9 | team_model_signing | ✅ | `Cyrus <role>` aliases in `team-model-signatures.json` |
| 10 | dedicated_worktrees | ✅ | [cursor-worktree-pattern.md](cursor-worktree-pattern.md); standing sandbox worktree (#3088) |
| 11 | visual_qa | ✅ (shared) | runtime-agnostic gate (`pretool_guard` git-tag block + `stop_checks`); `playwright-vision-low-resource` skill |
| 12 | wiki_docs_memory | ✅ (cross-runtime read) | reads `~/.copilot/wiki/` via `wiki-knowledge.instructions.md` (mirror Claude Code) |

## Parity-via-shared-mechanism (surfaces 11, 12)

These two surfaces are parity-complete by reusing a runtime-agnostic mechanism rather
than per-runtime duplication — consistent with the existing Claude Code / Codex treatment:

- **visual_qa**: the gate is runtime-agnostic — `pretool_guard.py` blocks `git tag` when UI is
  touched without a recorded `visual_qa`, and `stop_checks.py` includes it in the admin gate. Both
  are deployed to `~/.cursor/hooks/`. The `playwright-vision-low-resource` skill reaches Cursor via
  the shared skills dirs. Playwright MCP itself is operator-configured identically across all
  runtimes — none auto-register it, so Cursor carries no special-case here.
- **wiki_docs_memory**: Cursor reads `~/.copilot/wiki/` cross-runtime (no dedicated wiki home), the
  same model Claude Code uses; registered in `orchestrator-governance-parity.json` `wikiDocsParity`.

No open waivers remain for Cursor.
