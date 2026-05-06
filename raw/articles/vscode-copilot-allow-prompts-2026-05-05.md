# VS Code Copilot "Allow" prompt avoidance (2026-05-05)

## Summary
Repeated "Allow" prompts are primarily caused by trust/approval boundaries:
- file operations outside the trusted workspace path
- conservative tool approval mode (`Default Approvals`)

## Primary sources
- https://code.visualstudio.com/docs/editor/workspace-trust
- https://code.visualstudio.com/docs/copilot/agents/overview
- https://code.visualstudio.com/docs/copilot/agents/agent-tools
- https://code.visualstudio.com/docs/copilot/chat/review-code-edits

## Findings
1. Workspace Trust is shared across VS Code and Agents app; untrusted contexts disable or restrict agent actions.
2. Opening files outside trusted folders can trigger trust handling prompts.
3. Permission levels: `Default Approvals`, `Bypass Approvals`, `Autopilot`.
4. `chat.permissions.default` persists preferred approval mode.
5. Tool approvals can be tuned with pre/post approval controls.
6. Sensitive edits can still require review through `chat.tools.edits.autoApprove` rules.

## Operational policy for this repo
- Keep all writes under `/home/curtisfranks/devenv-ops`.
- Do not write directly to `~/.copilot/`, `~/.codex/`, `~/.agents/skills/`.
- Use repo-mediated deploy scripts for runtime propagation.
- Keep strict review for sensitive paths.
