# Copilot Instructions — Tool-Use Reliability (#3046)

Companion to [copilot-instructions-advanced.md](copilot-instructions-advanced.md).
All directives here apply to every Copilot session in this repo.

## Tool-Read-First Rule (anti-hallucination)

**Before authoring any governed artifact** (MANAGER_HANDOFF, COLLABORATOR_HANDOFF,
ADMIN_HANDOFF, CONSULTANT_CLOSEOUT, TEAM_QUESTION, TEAM_RESPONSE, or any GitHub
issue comment citing a ticket number), you MUST read the live source first:

1. **Ticket data** — run `gh issue view <N>` to get the actual title, AC, labels,
   and status. Never assume issue content from memory or training data.
2. **Repo state** — read relevant files via `read_file` before claiming their content.
3. **PR evidence** — run `gh pr view <N>` before citing branch, commit, or check status.

## Forbidden: Inventing Issue IDs

- **NEVER invent a GitHub issue number** (`#N`). Every `#N` cited in a baton artifact,
  PR body, or governance comment MUST correspond to a real, verifiable GitHub issue.
- Verify with `gh issue view <N>` before writing the `#N` reference.
- If the issue cannot be reached, write `#UNKNOWN` and note the lookup failure
  rather than substituting a plausible number.

## Forbidden: Fabricating Artifact Content

- Never fabricate ticket titles, AC text, PR URLs, commit SHAs, or CI check results.
- If a required data field is unavailable, mark it `TBD: <lookup-command>` in the draft
  and complete it after the tool call returns.
