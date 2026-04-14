# 8. Recommendations for devenv-ops

## 8.1 Immediate (Week 1)

**A. Harden PreToolUse hooks for destructive operations**
Create `.github/hooks/security-policy.json` with PreToolUse that
denies `rm -rf`, `DROP`, `DELETE FROM`, blocks edits to hook scripts.

**B. Add Stop hook for test/lint gate**
Create Stop hook running `npm run lint && npm test` before session
ends. Check `stop_hook_active` to prevent infinite loops.

**C. Protect hooks from agent self-modification**
Set `chat.tools.edits.autoApprove` to exclude `hooks/scripts/`
and `.github/hooks/` from auto-approval.

## 8.2 Short-term (Weeks 2-3)

**D. Align skills with CI checks (double-gate pattern)**
For each skill that defines a rule (e.g., ≤100 lines), ensure a
matching CI Action validates the same rule. Document the mapping.

**E. Add agent-scoped hooks to custom agents**
Add `hooks` frontmatter to security-scanner.agent.md and
governance-auditor.agent.md with PreToolUse/PostToolUse gates.

**F. Create PostToolUse audit logger**
Hook script logs every tool invocation (tool name, input, timestamp)
to `test-results/agent-audit.jsonl` for post-session review.

## 8.3 Medium-term (Weeks 4-6)

**G. Evaluate Agentic Workflows for continuous governance**
Install `gh-aw`, create workflow for daily lint/test/structure
checks. Start with read-only + issue creation safe outputs.

**H. Build governance MCP server**
MCP server exposing devenv-ops rules as tools/resources:
file-length checker, structure validator, instruction drift detector.

**I. Implement instruction-drift CI Action**
Action diffs `.github/copilot-instructions.md` and `AGENTS.md`
against known-good baseline, flags unauthorized changes.

## 8.4 Long-term (Month 2+)

**J. Copilot code review integration**
Enable Copilot code review with custom instructions for all PRs.

**K. Multi-agent governance via SubagentStart/Stop hooks**
Enforce subagents inherit governance rules. Log all activity.

**L. Explore Copilot SDK for custom governance tooling**
SDK (public preview Apr 2026) enables governance agents that
plan, invoke tools, and validate compliance programmatically.

## Priority Matrix

| Item | Effort | Impact | Priority |
|---|---|---|---|
| A. PreToolUse security | Low | High | P0 |
| B. Stop test gate | Low | High | P0 |
| C. Hook protection | Low | Medium | P0 |
| D. Skills↔CI matrix | Medium | High | P1 |
| F. Audit logger | Low | Medium | P1 |
| E. Agent-scoped hooks | Medium | Medium | P1 |
| I. Instruction drift CI | Medium | High | P1 |
| G. Agentic Workflows | High | High | P2 |
| H. Governance MCP | High | High | P2 |
| J. Code review | Low | Medium | P2 |
| K. Subagent governance | Medium | Medium | P3 |
| L. Copilot SDK | High | High | P3 |
