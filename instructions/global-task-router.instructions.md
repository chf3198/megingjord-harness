---
name: Global Task Router
description: Route work through free-first, fleet-second, premium-third lanes with explicit escalation evidence.
applyTo: "**"
---

# Global Task Router

Load the `global-task-router` skill for non-trivial work after `MANAGER_HANDOFF`.

## Lane order

1. **Free** — `Auto` / 0×-friendly work for lookup, analysis, docs, boilerplate.
2. **Fleet** — OpenClaw for medium implementation and known-pattern coding.
3. **Premium** — Sonnet-class reasoning only when justified by evidence.

## Escalation rules

- Start in the lowest adequate lane.
- Escalate only when complexity, ambiguity, retry risk, or urgency warrants it.
- Premium escalation requires a short rationale in progress updates.
- If the built-in model picker cannot be switched programmatically, emit a clear recommendation.

## Evidence minimum

Record these in state or progress updates:
- selected lane
- recommended backend/model
- rationale summary
- escalation trigger, if any

## Trigger examples

Escalate to **Fleet** for:
- medium multi-file edits
- test generation
- repeated transforms
- known-pattern refactors

Escalate to **Premium** for:
- architecture or design trade-offs
- ambiguous debugging
- high-risk refactors
- security/performance/concurrency analysis
- failure after a lower-lane attempt
