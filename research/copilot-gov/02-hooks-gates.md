# 2. Copilot Hooks & Gates

## 2.1 Architecture (Preview, April 2026)

VS Code hooks execute shell commands at agent lifecycle points.
Compatible with Claude Code and Copilot CLI hook formats.

## 2.2 Eight Lifecycle Events

| Event | Fires When | Governance Use |
|---|---|---|
| SessionStart | New session begins | Inject context, validate state |
| UserPromptSubmit | User submits prompt | Audit requests, inject context |
| **PreToolUse** | Before tool invocation | **Block dangerous ops, deny** |
| **PostToolUse** | After tool completes | Run formatters, lint, log |
| PreCompact | Before context compaction | Export state |
| SubagentStart | Subagent spawns | Track nested agents |
| SubagentStop | Subagent completes | Aggregate results |
| **Stop** | Session ends | **Enforce test gates** |

## 2.3 PreToolUse — Primary Governance Gate

- Input: `tool_name`, `tool_input`, `tool_use_id`
- Output: `permissionDecision`: `allow` / `ask` / `deny`
- Can modify input via `updatedInput`
- Can inject `additionalContext` warnings
- Multiple hooks: most restrictive wins (deny > ask > allow)

## 2.4 PostToolUse — Validation Gate

- Returns `decision: "block"` with reason to halt
- Injects `additionalContext` (e.g., "lint errors found")

## 2.5 Stop Hook — Completion Gate

- Returns `decision: "block"` + reason to force continuation
- Must check `stop_hook_active` to prevent infinite loops
- **Warning**: Continuation consumes premium requests

## 2.6 Hook File Locations

| Scope | Location |
|---|---|
| Workspace | `.github/hooks/*.json` |
| Claude compat | `.claude/settings.json` |
| User global | `~/.copilot/hooks` |
| Agent-scoped | `hooks` in `.agent.md` frontmatter |
| Plugin | `hooks.json` in plugin package |

## 2.7 What Hooks CAN Enforce

- Block destructive commands (`rm -rf`, `DROP TABLE`)
- Auto-format all file edits via PostToolUse
- Enforce test runs before session ends via Stop hook
- Audit every tool call via PostToolUse logging
- Inject project context at SessionStart
- Auto-approve safe ops, require confirmation for risky ones

## 2.8 What Hooks CANNOT Enforce

- Cannot directly call GitHub Actions APIs
- Do not run in cloud coding agent runtime
- Audit logs stay local unless manually pushed
- Agent can edit hook scripts (mitigate via auto-approve settings)
- No org-level hook enforcement for individual plans
