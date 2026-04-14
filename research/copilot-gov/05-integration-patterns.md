# 5. Integration Patterns

## 5.1 Hooks → Actions (Indirect Bridge)

Hooks cannot directly trigger Actions, but the workflow is:
1. **PostToolUse** hook writes audit log to file
2. **Stop** hook runs `npm test && npm run lint` locally
3. Git push triggers Actions CI pipeline
4. Actions validate everything the agent produced

## 5.2 Skills → CI Alignment (Double-Gate)

1. Skill defines "always run lint before commit"
2. Agent follows skill instructions locally (soft)
3. Actions CI independently verifies same lint rules (hard)
4. **Result**: soft enforcement + hard enforcement

## 5.3 Instructions → Code Review

1. `copilot-instructions.md` defines coding standards
2. Copilot code review uses instructions for PR review
3. Coding agent uses instructions during development
4. Human sees instruction-aware code + review comments

## 5.4 Agentic Workflows → Repository Governance

1. Workflow triggers on schedule or event
2. Runs coding agent: read-only + safe-outputs
3. Creates PR with linted, tested, reviewed code
4. Human approves/merges — never auto-merged

## 5.5 Hook + Agent Scoping

Custom agents (`.agent.md`) support agent-scoped hooks:
- security-scanner → PreToolUse blocks file writes
- governance-auditor → PostToolUse logs every action
- implementer → Stop hook enforces test suite pass

## 5.6 Governance Flow Diagram

```
┌─────────────────────────────────────────────────┐
│ VS Code Agent Session                           │
│                                                 │
│  AGENTS.md ──→ Session context                  │
│  Skills    ──→ On-demand rules                  │
│  Instructions ──→ Always-on standards           │
│                                                 │
│  PreToolUse Hook ──→ BLOCK dangerous ops        │
│  PostToolUse Hook ──→ FORMAT + LINT + LOG       │
│  Stop Hook ──→ REQUIRE tests pass               │
│                                                 │
│  git push ──→ GitHub Actions CI                 │
│              ├─ Lint check (hard gate)          │
│              ├─ Test suite (hard gate)          │
│              ├─ Security scan (hard gate)       │
│              └─ Copilot code review (soft gate) │
│                                                 │
│  PR ──→ Human review ──→ Merge                  │
└─────────────────────────────────────────────────┘
```
