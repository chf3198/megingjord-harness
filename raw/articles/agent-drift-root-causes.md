# Agent Drift: Root Causes

**Parent**: [agent-drift-governance.md](agent-drift-governance.md)

## 1. Attention Decay Over Context Length

"Lost in the Middle" (Liu et al., 2023): LLMs use U-shaped
attention. Content at beginning/end recalled well; middle ignored.
System prompts placed once at start become "middle content" as
conversation grows.

**Practitioner evidence**: "An hour in, it acts like the prompt
never existed. This happens with every model, every framework."
— OpenAI Community Forum

## 2. Context Rot in Long-Running Tasks

LOCA-bench (Zeng et al., 2026) quantifies "context rot" — as
agent environment states grow complex, performance degrades. Not
a step function but gradual decay correlated with context growth.

## 3. Inherited Goal Drift

Menon et al. (2026, ICLR Workshop): agents conditioned on
trajectories from weaker models inherit drift patterns. Critical
for multi-agent handoffs. Only GPT-5.1 showed consistent
resistance among tested models.

## 4. Helpfulness Bias vs. Instruction Following

Models trained for helpfulness override system constraints when
user requests conflict. GPT-5 exhibits "helpfulness bias" that
overrides instruction precision — prefers giving users what they
seem to want rather than following governance rules.

## 5. Intent Mismatch in Multi-Turn Conversation

Liu et al. (2026): LLMs "get lost" when user intent shifts across
turns. Model conflates earlier intent signals with current ones.
Compounds drift because user intent tracked more strongly than
system-level constraints.

## 6. KV Cache Compression Artifacts

Shi et al. (2025): KV cache compression used for inference
efficiency degrades multi-turn quality. Compressed prior turns
lose nuance including governance signals embedded early.

## 7. Drift as Bounded Equilibrium

Dongre et al. (2025) formalize drift as turn-wise KL divergence.
Key finding: drift reaches stable, noise-limited equilibria
rather than runaway degradation. Simple reminder interventions
reliably reduce divergence. Drift is controllable, not inevitable.
