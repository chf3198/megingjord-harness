# Agent Drift: Mitigation Patterns

**Parent**: [agent-drift-governance.md](agent-drift-governance.md)

## 1. Periodic Instruction Reinforcement

Dongre et al. prove drift is bounded and correctable with simple
reminder interventions. Practitioners confirm: "brief instructions
prepended to the last utterance greatly improves response
behavior." Inject condensed instruction summaries as developer
messages every N turns or at context checkpoints.

## 2. Context Replication over Splitting

Squad (GitHub/Microsoft) gives each specialist agent its own full
context window with repo-loaded instructions. Each agent "sees"
relevant context without competing for space. Avoids the shared-
context degradation problem entirely.

## 3. Drop-Box Pattern for Shared Memory

Squad commits decisions to versioned `decisions.md`. Async
knowledge sharing via repo files scales better than real-time
sync. Memory survives disconnects because it lives in project
files, not session state.

## 4. Explicit Memory in Prompt

Agent identity built on repository files (charter + history) plus
shared decisions. All plain text, versioned with code. Cloning a
repo clones the AI team's memory — no external state required.

## 5. Passive-to-Active Instruction Transformation

ContextCov converts AGENTS.md from passive text into executable
checks (AST validators, shell shims, architectural validators).
Drift caught at enforcement time, not after the fact.

## 6. Self-Review and Activation Steering

Li et al. (2026, ICLR): "activation steering with dynamic
rejection" modifies internal model activations to enhance
instruction following. Elder et al. (2025): instruction-following
improvements at scale through curriculum training.

## 7. Utterance Prepend Pattern

Prepending brief instruction summaries to the most recent user
message significantly improves adherence versus relying solely
on distant system prompts. OpenAI community validated.

## 8. Session Anchor Files

Practitioner pattern: "keep a session anchor file with core
instructions — paste at session start, split large tasks into
smaller steps." Reduces context pressure by decomposing work.

## 9. Independent Review Protocol

Squad prevents agents from reviewing own work — a different agent
must fix rejected code. This addresses self-reinforcement drift
where a single agent compounds its own errors.
