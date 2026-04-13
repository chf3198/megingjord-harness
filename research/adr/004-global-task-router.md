# ADR-004: Global Task Router

**Status**: Accepted
**Date**: 2026-04-13

## Context

Copilot native Auto selection cannot be conditionally forced by prompt.
We need policy-driven routing across free, fleet, and premium lanes.
The system must be global, hook-aware, and evidence-backed.

## Decision

Implement a global router subsystem with four components:
1. Policy instruction: lane order and escalation rules
2. Skill contract: classification + output format
3. Router scripts: classify, dispatch, smoke-test
4. Hook integration: persist route decision in governance state

Routing policy:
- Free first for simple tasks
- Fleet (OpenClaw) for medium known-pattern implementation
- Premium (Sonnet recommendation) for complex/risky work

## Consequences

Positive:
- Consistent escalation logic across repositories
- Reduced premium burn via explicit free-first policy
- Traceable routing evidence in hook state
- Testable behavior via smoke script

Trade-offs:
- Keyword scoring is heuristic and may misclassify edge prompts
- Premium lane remains recommendation when model picker is closed
- Future phases should add telemetry-based adaptive thresholds
