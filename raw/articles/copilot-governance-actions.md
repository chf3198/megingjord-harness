# Copilot Pro Governance Tied to GitHub Actions

**Ticket**: #61 | **Date**: 2026-04-14 | **Status**: Complete

## Summary Table

| Governance Surface | Maturity | Enforcement | devenv-ops Impact |
|---|---|---|---|
| Custom Instructions | GA | Soft (advisory) | Already using |
| AGENTS.md | GA | Soft (advisory) | Already using |
| Path .instructions.md | GA | Soft (advisory) | Already using |
| Agent Skills (SKILL.md) | GA | Soft (on-demand) | Already using |
| VS Code Hooks | Preview | Hard (block/deny) | Partial |
| Coding Agent (cloud) | GA | Soft + CI gates | Not integrated |
| Agentic Workflows | Tech Preview | Hard (sandboxed) | New opportunity |
| MCP Servers | GA | Hard (sandboxed) | Partial |
| Copilot Code Review | GA | Soft (PR comments) | Not integrated |

## Section Index

1. [Instructions System](copilot-gov/01-instructions-system.md)
2. [Hooks & Gates](copilot-gov/02-hooks-gates.md)
3. [Actions as Governance](copilot-gov/03-actions-governance.md)
4. [MCP & Extensions](copilot-gov/04-mcp-extensions.md)
5. [Integration Patterns](copilot-gov/05-integration-patterns.md)
6. [Limitations](copilot-gov/06-limitations.md)
7. [Key Sources](copilot-gov/07-sources.md)
8. [Recommendations](copilot-gov/08-recommendations.md)

## Actionable Next Steps

1. Create `security-policy.json` PreToolUse hook
2. Create `test-gate.json` Stop hook
3. Add PostToolUse audit logger hook
4. Document skills ↔ CI alignment matrix
5. Evaluate `gh-aw` for continuous governance
