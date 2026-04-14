---
title: "Self-Annealing Protocol"
type: concept
created: 2026-04-14
updated: 2026-04-14
tags: [governance, workflow]
sources: []
related: ["[[agent-drift]]", "[[baton-protocol]]", "[[governance-enforcement]]"]
status: draft
---

# Self-Annealing Protocol

Bounded review cycle that detects and corrects operational drift.

## When to Run
- After failures or repeated mismatches
- After long sessions (>10 tool calls)
- Before merge or release
- When process violations are detected

## Protocol Steps
1. Collect evidence (events, comments, artifacts)
2. Compare against expected protocol
3. Score drift (0-10 scale)
4. Identify specific deviations
5. Apply corrections (retroactive if needed)
6. Document findings in Consultant CLOSEOUT

## Integration Points
- [[baton-protocol]] Consultant phase triggers review
- Event bus provides audit trail
- wiki/log.md captures operational history

See: [[workflow-self-anneal]], [[agent-drift-recommendations]]
