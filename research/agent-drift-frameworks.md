# Agent Drift: Industry Governance Frameworks

**Parent**: [agent-drift-governance.md](agent-drift-governance.md)

## NVIDIA NeMo Guardrails (v0.21.0)

Open-source (6k stars). Five rail types: input, dialog,
retrieval, execution, output. Colang language enables programmable
dialog control. Configurations are declarative YAML + Colang.
Key differentiator: dialog modeling, not just content filtering.
— https://github.com/NVIDIA-NeMo/Guardrails

## Guardrails AI

Python framework wrapping LLM calls with Input/Output Guards.
Guardrails Hub provides pre-built validators composable into
guard pipelines. Focus on output validation.
— https://www.guardrailsai.com/docs

## Microsoft AgentRx (March 2026)

Synthesizes executable constraints from tool schemas and domain
policies. Validates trajectories step-by-step. Nine-category
failure taxonomy including Plan Adherence Failure, Invention of
New Information, Invalid Invocation, Intent-Plan Misalignment.
Results: +23.6% failure localization, +22.9% root-cause
attribution over prompting baselines. Open-source.
— https://aka.ms/AgentRx/Code

## Microsoft PlugMem (March 2026)

Task-agnostic memory converting raw interaction history into
structured knowledge (facts + skills). Raw memory retrieval
overwhelms agents with low-value context. PlugMem delivers more
decision-relevant information while consuming less context window.
Directly addresses drift's root cause.
— https://github.com/TIMAN-group/PlugMem

## ContextCov (Sharma, 2026)

Transforms passive AGENTS.md into active executable guardrails:
- Static AST analysis for code pattern violations
- Runtime shell shims intercepting prohibited commands
- Architectural validators for structural constraints

Evaluated on 723 repos: 46k+ executable checks, 99.997% syntax
validity. Directly addresses the devenv-ops use case.
— arXiv:2603.00822

## Wink (Nanda et al., 2026)

Lightweight async self-intervention for coding agent misbehavior.
Three categories found in ~30% of trajectories: Specification
Drift, Reasoning Problems, Tool Call Failures. Resolves 90% of
single-intervention misbehaviors. Production-validated at scale.
— arXiv:2602.17037
