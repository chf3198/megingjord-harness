# Agent Drift: Recommendations for devenv-ops

**Parent**: [agent-drift-governance.md](agent-drift-governance.md)

## R1: Instruction Reinforcement Hooks

Add a Copilot hook injecting condensed governance reminders at
periodic intervals during long sessions. Based on Dongre et al.'s
finding that drift is bounded and correctable with reminders.
Implement as developer-message injection every N tool calls.

## R2: Convert Skills to Executable Constraints

Following ContextCov, transform critical SKILL.md files into
executable validation: AST linters, shell shims, pre-commit
hooks. Passive text is the weakest governance layer. Priority
targets: role-baton-orchestrator, operator-identity-context.

## R3: Instruction Deduplication Audit

Audit all 33 skills + 12 instructions for conflicting or
redundant directives. GitHub warns against instruction conflicts.
Every conflict is a drift invitation. Deduplicate aggressively.

## R4: Path-Scoped Instruction Maximization

Leverage `.github/instructions/NAME.instructions.md` with
`applyTo` globs aggressively. Narrower scope = less context
competition = less drift. Prefer many small scoped instructions
over one large global file.

## R5: Session Anchor Protocol

Define a compressed instruction summary (<300 tokens) capturing
top governance constraints. Inject at session start and context
checkpoints. Template should cover: identity, baton sequence,
file limits, branch rules.

## R6: Self-Anneal with Drift Detection

Extend `workflow-self-anneal` skill with explicit drift detection.
Compare current agent behavior against instruction baseline,
similar to AgentRx's constraint validation approach.

## R7: Decompose Long Tasks

Every multi-file task decomposes into bounded subtasks, each with
own context window. Follows Squad "context replication" pattern.
Avoids middle-of-context dead zone identified by Liu et al.

## R8: Organization Instruction Layer

Establish strict layering when org-level instructions deploy:
- Org = security/compliance constraints
- Repo = architecture/conventions
- Path = file-specific patterns
Never duplicate across layers.

## Priority Order

1. **R3** (audit) — zero-cost, high-impact, do first
2. **R5** (anchor) — low-cost, addresses core mechanism
3. **R4** (path-scoped) — leverage existing Copilot feature
4. **R1** (hooks) — requires hook development
5. **R2** (executable) — highest effort, highest ceiling
6. **R6** (self-anneal) — extends existing skill
7. **R7** (decompose) — process change
8. **R8** (org layer) — depends on org instructions rollout
