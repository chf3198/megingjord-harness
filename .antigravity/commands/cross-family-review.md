---
name: "cross-family-review"
description: "Dispatch cross-family adversarial review at lifecycle points L1-L5."
argument-hint: "[ticket:#N] [--lifecycle L2|L3|L4] [--model qwen2.5-coder:32b|7b]"
---

# Cross-Family Review

Invoke this command to run a cross-family review at the requested lifecycle point.
See `skills/cross-family-review/SKILL.md` for the full skill contract.

## Dispatch

```bash
node scripts/global/fleet-red-team-dispatch.js \
  --artifact-type <type> \
  --ticket <N> \
  [--lifecycle L2|L3|L4] \
  [--model qwen2.5-coder:32b|qwen2.5-coder:7b]
```

Lifecycle points: `L2` (COLLABORATOR_HANDOFF), `L3` (PR diff), `L4` (CONSULTANT_CLOSEOUT).

## Output

Required fields:
- `cross_family_rating: <int>/10`
- `cross_family_reviewer: <model>@<host>`
- `cross_family_findings: [<finding>, ...]`
- `cross_family_verdict: ACCEPT|PARTIAL|REJECT — <model@host> — <rationale>`

Post findings to the linked GitHub issue using `baton-fleet-review-comment.js`.

## Constraints

- Cross-family invariant: dispatched model must NOT be Anthropic/Claude or Google/Gemini family.
- G3-first routing: 36gbwinresource fleet → OpenClaw → paid fallback.
- Max 3 iterations per lifecycle point.
- Do not block the baton on L2/L3 findings — advisory only.
- L4 CONSULTANT_CLOSEOUT: REJECT is a hard block requiring Manager resolution.
