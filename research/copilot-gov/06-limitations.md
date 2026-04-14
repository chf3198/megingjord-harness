# 6. Current Limitations

## 6.1 Enforcement Is Advisory, Not Blocking

- Instructions, AGENTS.md, skills are **soft guidance**
- LLM may ignore instructions under prompt pressure
- No cryptographic or runtime guarantee of compliance
- Only hooks provide hard blocking (VS Code/CLI only)

## 6.2 Cloud Agent Has Separate Runtime

- VS Code hooks do NOT run in cloud coding agent
- Cloud agent respects copilot-instructions.md and AGENTS.md
- Cloud agent runs its own CI, security scanning, code review
- No hook equivalent for cloud agent (as of April 2026)

## 6.3 No Hooks → Actions Bridge

- Hooks cannot call GitHub Actions API or trigger workflows
- No webhook emission from hook scripts
- Audit logs stay local unless manually pushed

## 6.4 Agent Can Edit Its Own Hooks

- Agent with file-edit access can modify hook scripts
- Mitigate: `chat.tools.edits.autoApprove` exclusions
- No immutable hook enforcement mechanism yet

## 6.5 Skill Compliance Not Verified

- No mechanism to verify agent actually followed a skill
- No diff between "skill said X" and "agent did Y"
- Must rely on CI/Actions to validate outcomes

## 6.6 Copilot Pro (Individual) Limitations

- No organization-level instruction enforcement
- No enterprise policies for hook management
- Code review custom instructions require repo settings
- Agentic Workflows require Actions minutes + premium requests

## 6.7 Hook Maturity

- Hooks are Preview — format and behavior may change
- Organizations may disable hooks via enterprise policy
- Claude Code matcher syntax parsed but ignored by VS Code
- Tool names differ between Claude Code and VS Code

## 6.8 Agentic Workflows Limitations

- Technical Preview — not yet production-stable
- Each run incurs ~2 premium requests minimum
- Must install `gh-aw` CLI extension
- Compiled lock file must be committed alongside workflow
- Limited to supported coding agent engines
