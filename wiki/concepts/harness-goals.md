---
title: "Harness Goal Constitution"
type: concept
created: 2026-05-06
status: active
---
# Harness Goal Constitution

## Summary

The harness goal constitution is the priority-ordered decision lens for governed
work across Claude Code, Copilot, and Codex sessions. It keeps role workflow,
cost routing, privacy, runtime behavior, and cross-team compatibility aligned.

## Canonical Order

1. Governance
2. Quality
3. Zero Cost
4. Privacy
5. Portability
6. Resilience
7. Throughput
8. Observability
9. Interoperability

## Decision Rule

Evaluate governed decisions in order. If a lower-priority goal wins over a
higher-priority goal, record the rationale in the ticket, PR, or closeout
evidence.

## Always-Loaded Surfaces

- `.github/copilot-instructions.md`
- `.codex/AGENTS.md`
- `instructions/global-standards.instructions.md`
- `instructions/harness-goals.instructions.md`
- `hooks/scripts/goal_lens.py`

## Goal Definitions

- Governance: policy, role, provenance, and ticket controls are non-negotiable.
- Quality: maximize correctness and engineering value of outcomes.
- Zero Cost: prefer local, fleet, and free lanes before paid providers.
- Privacy: keep sensitive context local unless explicit override exists.
- Portability: avoid user-specific coupling; settings-driven behavior preferred.
- Resilience: degrade gracefully and keep fallback paths for partial outages.
- Throughput: preserve acceptable speed after higher-priority goals are met.
- Observability: make decisions and outcomes visible, auditable, attributable.
- Interoperability: preserve compatibility across agent surfaces and runtimes.

## Sources

- Epic #1024: harden harness OKR goals as always-available session context.
- Research #1025: reconciles provisional O1-ON lists to the 9-goal order.
- Task #1030: installs the always-loaded instruction and hook context surfaces.
