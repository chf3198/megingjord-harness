# Cross-Runtime Enforcement Contract (Refs #3048)

Documents which governance guards reach Copilot vs Claude Code tool calls,
and specifies the legible deny message each blocking guard emits.

Parent: Epic #3041 (VS Code Copilot BYOK full-parity citizen).

## TL;DR

| Guard | Claude Code reach | Copilot reach |
|---|---|---|
| `pretool_guard.py` | **blocking** (PreToolUse) | advisory |
| `commit_ticket_gate.py` | **blocking** (PreToolUse) | advisory |
| `manager_ticket_gate.py` | advisory (UserPromptSubmit) | advisory |
| `canonical_main_wip_check.py` | advisory (SessionStart) | advisory |
| `stop_reminder.py` | advisory (Stop) | advisory |
| `posttool_reminders.py` | advisory (PostToolUse) | advisory |

Only `pretool_guard.py` and `commit_ticket_gate.py` can emit a hard deny that
prevents a tool call from executing in Claude Code. All Copilot guards are
advisory today (VS Code hook preview limitation — see §Copilot gap below).

## Hook event map (Claude Code)

Claude Code wires the following scripts via `~/.claude/settings.json`:

| Event | Scripts wired |
|---|---|
| `SessionStart` | `session_context.py`, `hamr_activation_check.py`, `prune_file_history.py`, `canonical_main_wip_check.py`, `runtime_session_register.py` |
| `UserPromptSubmit` | `manager_ticket_gate.py`, `goal_lens.py`, `userprompt_gate.py` |
| `PreToolUse` | `commit_ticket_gate.py`, `pretool_guard.py` |
| `PostToolUse` | `posttool_reminders.py` |
| `Stop` | `stop_reminder.py` |

`PreToolUse` is the only event where a guard can return
`permissionDecision: "deny"` and reliably prevent the tool call.
`UserPromptSubmit` and `Stop` may inject `additionalContext` (advisory)
or return a `block` decision on Stop to request continuation, but neither
blocks individual tool calls mid-session.

## Blocking guards and their deny messages

### `pretool_guard.py` (PreToolUse)

Scope: canonical-main write guard, blast-radius cap, IT-ops bypass detector,
admin-sequencing gate, shell-write-target analysis.

Deny message surface:
```
DENY [pretool_guard]: canonical-main write blocked or blast-radius cap exceeded.
Use a dedicated worktree branch or review governance state.
```

Operator action: switch to a worktree branch (`scripts/worktree-session-start.sh`)
or check `blast_radius` in governance state.

### `commit_ticket_gate.py` (PreToolUse)

Scope: blocks `git commit` when no active ticket is in governance state or when
the commit message lacks a `#N` issue reference.

Deny message surface:
```
DENY [commit_ticket_gate]: commit references no active ticket.
Set active_ticket in governance state or include #N in the commit message.
```

Operator action: set `active_ticket` via `python3 hooks/scripts/state_store.py`
or include `Refs #N` in the commit subject.

## Advisory guards

Advisory guards inject `additionalContext` into the model's context window.
They do not prevent tool execution. A deny from an advisory guard is a
recommendation the model should follow by governance contract, but the tool
call is not mechanically blocked.

| Guard | Event | Advisory topic |
|---|---|---|
| `manager_ticket_gate.py` | UserPromptSubmit | No active ticket before implementation |
| `goal_lens.py` | UserPromptSubmit | Goal-lens priority reminder |
| `userprompt_gate.py` | UserPromptSubmit | Route context + pre-closeout gating |
| `session_context.py` | SessionStart | Session state injection |
| `hamr_activation_check.py` | SessionStart | HAMR activation advisory |
| `canonical_main_wip_check.py` | SessionStart | WIP check on canonical-main |
| `posttool_reminders.py` | PostToolUse | Post-action governance reminders |
| `stop_reminder.py` | Stop | Admin completion checklist |

## Copilot gap

GitHub Copilot's VS Code hook preview supports `PreToolUse` events, but the
`permissionDecision: deny` mechanism is **not yet hard-enforced** — it surfaces
a warning but cannot reliably prevent the tool call (see
`research/copilot-governance-actions.md` §2.8 "What Hooks CANNOT Enforce").

Gap remediation: Epic #3041 BYOK parity work includes adding server-side
enforcement parity. Until that ships, Copilot relies on:

1. `permissions-config.json` tool-approval allowlist (hard — unknown commands
   require explicit approval in the VS Code UI).
2. Workspace instructions (`.github/copilot-instructions.md`) as advisory layer.
3. CI gates (baton-gates.yml, label-lint.yml) as the backstop.

## Enforcement module

`scripts/global/cross-runtime-enforcement.js` exports the machine-readable
contract used by tests:

```js
const { guardInfo, denyMessage, DENY_CAPABLE } = require('./cross-runtime-enforcement');
guardInfo('pretool_guard.py');
// { script, reach, denyCapable, claudeCodeReach, copilotReach }
denyMessage('pretool_guard.py');
// legible operator-actionable string
```

## Related

- `docs/howto/hook-parity-check.md` — 3-way branch/main/deployed diff tool
- `research/copilot-governance-actions.md` — Copilot hook capability analysis
- `inventory/orchestrator-governance-parity.json` — parity registry
- `instructions/owasp-agentic-mapping.instructions.md` OA2 (Tool Misuse)
