# Agent Drift: Copilot-Specific Findings

**Parent**: [agent-drift-governance.md](agent-drift-governance.md)

## Instruction Hierarchy

GitHub Copilot provides three instruction scopes:
1. **Repository-wide**: `.github/copilot-instructions.md`
2. **Path-specific**: `.github/instructions/NAME.instructions.md`
   with `applyTo` glob patterns
3. **Agent instructions**: `AGENTS.md` anywhere in repo tree
   (nearest file in directory tree takes precedence)

Also supports `CLAUDE.md` and `GEMINI.md` in repo root.
Priority: Personal > Repository > Organization.

## Instruction Size Limits

GitHub recommends max ~2 pages and warns against task-specific
content. Instructions should be "general coding guidelines."
This implies finite context budget for instruction injection.

## Conflict Warning

GitHub explicitly warns: "try to avoid providing conflicting sets
of instructions." The platform knows instruction conflict causes
drift and does not resolve it automatically.

## Organization-Level Instructions (GA April 2026)

Org custom instructions now GA, plus org runner controls and
firewall settings for cloud agent. New governance layer but also
new conflict surface between org/repo/path scopes.

## Agent Mode Limitations

GitHub acknowledges agent mode is "not ideal for altering domain
invariants without human review" or "large sweeping rewrites."
Copilot positioned as partner requiring human judgment.

## Multi-Agent Coordination (Squad)

Repository-native multi-agent orchestration. Coordinator spawns
specialists with independent context windows. Review protocol
prevents self-review — different agent must fix rejected code.

Key patterns from Squad architecture:
- "Drop-box" shared memory via versioned markdown files
- Context replication (each agent gets full context, not split)
- Explicit prompt-based memory over implicit weight-based memory
- Agent identity stored in repo `.squad/` folder
- Two commands to initialize: `squad init` per repo

## Path-Scoped Instruction Power

The `applyTo` glob in path-specific instructions is the strongest
drift-prevention feature available. Narrower scope = less context
competition = less drift. devenv-ops should maximize this.
