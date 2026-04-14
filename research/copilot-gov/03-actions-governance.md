# 3. GitHub Actions as Governance Layer

## 3.1 Standard CI Validation (Already Works)

Actions CI runs on every push/PR, including Copilot-generated:
- Linting (ESLint, Prettier, custom scripts)
- Testing (unit, integration, e2e)
- File-length enforcement (devenv-ops ≤100 lines)
- Security scanning (CodeQL, dependency review)
- Custom compliance checks (structure, naming)

## 3.2 Copilot Coding Agent + Actions

The cloud coding agent now includes:
- **Self-review**: Copilot code review on its own PR
- **Security scanning**: Code, secret, dependency checks built-in
- **Custom agents**: `.github/agents/` for team workflows
- **Org runner controls**: Manage which runners agent uses
- **Commit signing**: Cloud agent signs commits (Apr 2026)

Agent operates within the same CI pipeline:
1. Agent creates branch and commits
2. CI Actions trigger on push
3. Agent iterates if CI fails
4. PR opened only after self-review passes
5. Human reviews the PR

## 3.3 Agentic Workflows (Technical Preview)

**GitHub Agentic Workflows** = coding agents in Actions:
- Authored in Markdown + YAML frontmatter
- Triggers: schedule, issues, PRs, etc.
- Engines: Copilot CLI, Claude Code, OpenAI Codex
- **Sandboxed**: read-only, write-buffered via safe outputs
- Safe outputs: explicit allowlist of GitHub operations
- Secret isolation: agent has zero access to secrets
- Network isolation: firewalled, MCP through gateway

**Security Architecture (4-layer defense)**:
1. Substrate: Runner VM, Docker, network isolation
2. Configuration: Compiler, firewall, MCP config
3. Planning: Safe outputs, call filtering, sanitization
4. Logging: Network, API proxy, MCP gateway, tool logs

## 3.4 CI-as-Governance Patterns

| Pattern | How It Works |
|---|---|
| Lint-on-push | Actions validate formatting, length, naming |
| Test-on-push | Agent must fix test failures |
| Structure-check | Custom Action verifies file organization |
| Instruction-drift | Action diffs instructions against baseline |
| Code review | Copilot auto-reviews PRs (60M+ shipped) |
| Secret scanning | Built into coding agent workflow |
