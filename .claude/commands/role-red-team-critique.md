---
description: "Dispatch adversarial cross-family fleet review of baton artifacts, PR diffs, or governance docs."
argument-hint: "[artifact-type] [ticket:#N] [--stakes high|medium|low] [--model qwen2.5-coder:32b|7b]"
---

# Role: Red-Team Critique

Invoke this command to run an adversarial review using a non-Anthropic fleet model.
See `skills/role-red-team-critique/SKILL.md` for the full skill contract.

## Dispatch

```bash
node scripts/global/fleet-red-team-dispatch.js \
  --artifact-type <type> \
  --ticket <N> \
  [--stakes high|medium|low] \
  [--model qwen2.5-coder:32b|qwen2.5-coder:7b]
```

Artifact types: `epic-scope | child-implementation | collaborator-handoff |
admin-handoff | pr-diff | instruction-edit | consultant-closeout`

Model selection uses `config/red-team-model-matrix.yml` automatically.
Pass `--stakes high` to force 32B; omit for auto-selection (defaults to 7B).

## Output

Post findings to the linked GitHub issue using `baton-fleet-review-comment.js`.
Classify each finding: ACCEPT / REJECT / PARTIAL.
Assign `hallucination_risk: low | medium | high` per finding.

## Constraints

- Cross-family invariant: dispatched model must NOT be Anthropic/Claude family.
- Max 3 iterations per artifact. Unresolved partials become follow-up tickets.
- Fleet host: `100.91.113.16:11434` (Tailscale). Skip with note if offline.
- Do not block the baton on red-team findings — advisory only.
