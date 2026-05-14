---
name: Harness Goal Constitution
description: Priority-ordered goals (G1-G10) and decision lens for all governed work.
applyTo: "**"
---
# Harness Goal Constitution (Priority-Ordered)

G1 Governance > G2 Quality > G3 Zero Cost > G4 Privacy & Security > G5 Portability >
G6 Resilience > G7 Throughput > G8 Observability > G9 Interoperability >
G10 Maintainability.

## Definitions

- G1 Governance: policy, role, provenance, and ticket controls are non-negotiable.
- G2 Quality: correctness, testability, and engineering value are governance-enforced.
  Requires: TDD/EDD coverage floor (>=80%), functional-first design, measurable
  acceptance criteria, and passing lint/type checks before merge.
- G3 Zero Cost: prefer local/fleet/free lanes before paid providers.
- G4 Privacy & Security: sensitive context stays local unless explicit override exists;
  secrets never in git, env vars, or logs; least-privilege tokens enforced; supply-chain
  dependencies pinned; agent-consumed inputs sanitised against injection.
- G5 Portability: avoid user-specific coupling; settings-driven behavior preferred.
- G6 Resilience: graceful degradation and fallback paths for partial outages.
- G7 Throughput: acceptable speed after higher-priority goals are satisfied.
- G8 Observability: decisions and outcomes are visible, auditable, and attributable.
- G9 Interoperability: preserve compatibility across agent surfaces and runtimes.
- G10 Maintainability: files <=100 lines; cyclomatic complexity <=10 per function;
  no dead code at merge; changes documented via GOV-009 EDD before implementation.

## Decision Lens (lightweight, required)

For any design/routing/tooling decision, briefly verify in this order:
1) Is it governance-compliant? 2) Does it improve or preserve quality?
3) Can it run at zero cost first? 4) Is privacy and security preserved by default?
5) Is it portable? 6) Is degradation safe? 7) Is it fast enough?
8) Is it observable? 9) Does it remain interoperable? 10) Is it maintainable?
