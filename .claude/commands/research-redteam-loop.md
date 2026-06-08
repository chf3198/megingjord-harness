---
description: "Run the web-augmented cross-family red-team consensus loop on a research deliverable."
argument-hint: "#N [--gate 93] [--web] [--cap 5]"
---

# /research-redteam-loop

Run the research→red-team→rework→consensus loop on issue `#N`.
See `skills/research-redteam-loop/SKILL.md` for the full contract.

## Usage

```
/research-redteam-loop #2710 --gate 93 --web --cap 5
```

## What this does

1. Reads/refreshes the research deliverable for `#N`.
2. Fetches web evidence (3+ refs); degrades gracefully if unavailable.
3. Dispatches to fleet (qwen, 120 s timeout) or free-cloud fallback
   (gemini/groq/cerebras, 45 s). Cross-family invariant enforced.
4. Checks score against `--gate`. Posts `RESEARCH_REDTEAM_ITER` comment.
5. If score ≤ gate: Manager reworks with reviewer findings + web context.
6. Repeats until score > gate or `--cap` exhausted.
7. Posts `RESEARCH_REDTEAM_ACCEPT` or `RESEARCH_REDTEAM_REJECT`.

## Dispatch commands

```bash
# Fleet (primary, G3 zero-cost)
node scripts/global/fleet-red-team-dispatch.js \
  --artifact-type research-deliverable \
  --ticket <N> \
  --model qwen2.5-coder:32b

# Free-cloud fallback (when fleet unreachable)
node scripts/global/free-cloud-dispatch.js \
  --prompt "$(cat /tmp/review-prompt.txt)"
```

## Output format

Each iteration posts a structured comment to the target issue:
```
RESEARCH_REDTEAM_ITER: N | score=<N>/100 | reviewer=<model@host> | web=<yes|no>
```

## Constraints

- Cross-family invariant: reviewer MUST NOT be Anthropic/Claude.
- No paid provider at any tier; G3 fleet/free-cloud only.
- Cap default: 5 iterations. Override with `--cap`.
- Gate default: 93. Override with `--gate`.
