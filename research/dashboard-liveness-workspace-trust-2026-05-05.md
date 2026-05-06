---
title: "Dashboard liveness closure + Copilot allowance avoidance — 2026-05-05"
type: research
created: 2026-05-05
updated: 2026-05-05
status: complete
tags: [dashboard, vscode, copilot, workspace-trust, approvals, epic-849]
sources: ["https://code.visualstudio.com/docs/editor/workspace-trust", "https://code.visualstudio.com/docs/copilot/agents/overview", "https://code.visualstudio.com/docs/copilot/agents/agent-tools", "https://code.visualstudio.com/docs/copilot/chat/review-code-edits"]
---

# Dashboard liveness closure + Copilot allowance avoidance — 2026-05-05

**Date**: 2026-05-05  
**Ticket**: #853 (research), #1004 (implementation)  
**Epic**: #849  
**Last updated**: 2026-05-05T00:00:00Z

## Summary table

| Topic | Finding | Operational rule |
|---|---|---|
| Workspace Trust | Files outside trusted folders trigger trust/untrusted prompts | Keep all edits inside workspace root (`/home/curtisfranks/devenv-ops`) |
| Agent approvals | `Default Approvals` prompts for many tool calls | Use session permission level `Bypass Approvals` or `Autopilot` when safe |
| Tool approvals | VS Code supports per-tool pre/post approvals | Pre-approve safe tools; keep destructive tools reviewed |
| Sensitive edits | `chat.tools.edits.autoApprove` can require manual approval for protected files | Keep strict rules for sensitive files; avoid external-path writes entirely |

## Detailed findings with source links

1. **Workspace trust boundary is path-based.**
   Files outside trusted folders are treated as untrusted, and VS Code can prompt for trust decisions. This is the root cause of repeated "Allow" interruptions when agents attempt to write outside the active trusted workspace.
   Source: https://code.visualstudio.com/docs/editor/workspace-trust

2. **Agent permission levels control approval friction.**
   `Default Approvals` is conservative, while `Bypass Approvals` and `Autopilot` auto-approve tool calls for the session. `chat.permissions.default` can persist the preferred mode.
   Sources: https://code.visualstudio.com/docs/copilot/agents/overview and https://code.visualstudio.com/docs/copilot/agents/agent-tools

3. **Tool approval model is configurable and granular.**
   VS Code supports pre-approval and post-approval by tool source, plus URL-approval controls and terminal auto-approval controls.
   Source: https://code.visualstudio.com/docs/copilot/agents/agent-tools

4. **Sensitive-file protections are independent from workspace trust.**
   `chat.tools.edits.autoApprove` can force manual review for selected paths (for example `.env` and `.vscode/*.json`) even when other edits are auto-approved.
   Source: https://code.visualstudio.com/docs/copilot/chat/review-code-edits

## Practical no-prompt operating profile (Copilot Team)

1. **Never write outside workspace root** during autonomous sessions.
2. **Do not target runtime homes** such as `~/.copilot/`, `~/.codex/`, or `~/.agents/skills/` from this repo session.
3. **Use only in-repo source-of-truth paths** and deploy through repo workflows.
4. **Prefer session `Bypass Approvals`** only in trusted repos with known governance.
5. **Retain sensitive-file review rules** for config/secret-bearing files.

## Actionable next steps

1. Keep this policy in the Karpathy wiki as both source and concept pages.
2. Add a checklist item to Epic closeout templates: "No external-path writes during session."
3. Re-run this verification when VS Code updates permission/approval behavior.

Refs #853, #849