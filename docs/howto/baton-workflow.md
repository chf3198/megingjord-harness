# Developer HOWTO: End-to-End Baton Workflow

Step-by-step guide for taking a task from user request to closed ticket.
Refs #639 #335

## Overview

Every change in Megingjord goes through a single-threaded baton sequence. One role is
active at a time per ticket. The GitHub issue IS the baton — whoever holds the active
`role:*` label owns the current step.

```
Manager → Collaborator → Admin → Consultant → done + closed
```

## 1. Manager Phase

**Entry**: User request or backlog item.

**Create the ticket first — never code first.**

```bash
gh issue create \
  --title "Verb phrase describing the change" \
  --body "## Problem\n...\n## Acceptance Criteria\n- [ ] AC1\n- [ ] AC2" \
  --label "type:task,status:triage,priority:P2,area:scripts"
```

Title rules: plain imperative ≤72 chars. No `feat(scope):` prefix on issue titles.

**Post scope comment** with objective, ACs, and constraints. End it with:

```
MANAGER_HANDOFF

Signed-by: <alias>
Team&Model: devenv-ops:<model>@<substrate>
Role: manager
```

**Transition labels**:

```bash
gh issue edit N --remove-label "status:triage,role:manager" --add-label "status:ready"
```

## 2. Collaborator Phase

**Entry**: Issue at `status:ready`.

```bash
# Pick up the ticket
gh issue edit N --remove-label "status:ready" --add-label "status:in-progress,role:collaborator"

# Create branch in your worktree
git checkout -b feat/N-short-slug

# Implement, then validate every AC with evidence
```

**When all ACs are checked ✅**, post the handoff:

```
COLLABORATOR_HANDOFF

Signed-by: <alias>
Team&Model: devenv-ops:<model>@<substrate>
Role: collaborator

AC evidence:
- AC1: <test output or command result>
- AC2: <file path or CI link>
```

Wait at least 60 seconds, then create the PR:

```bash
gh pr create \
  --title "feat(scope): imperative description #N" \
  --body "... COLLABORATOR_HANDOFF ... ADMIN_HANDOFF ... CONSULTANT_CLOSEOUT ... Refs #N"
```

PR title: `type(scope): description #N` ≤60 chars. Use `Refs #N`, never `Closes #N`.

**Transition**:

```bash
gh issue edit N --remove-label "status:in-progress,role:collaborator" --add-label "status:testing,role:admin"
```

## 3. Admin Phase

**Entry**: Issue at `status:testing`. PR exists with all gates pending.

Verify all required CI checks are green:

- `collaborator-gate` — COLLABORATOR_HANDOFF confirmed on linked issue
- `admin-gate` — ADMIN_HANDOFF confirmed on linked issue
- `consultant-gate` — CONSULTANT_CLOSEOUT confirmed on linked issue
- `evidence-completeness` — COLLABORATOR_HANDOFF predates PR creation by ≥60 s
- `lint-required` — markdownlint + eslint + shellcheck pass
- `pr-title-required` — title ≤60 chars

Post the ADMIN_HANDOFF on the issue (not the PR body):

```
ADMIN_HANDOFF

Signed-by: <alias>
Team&Model: devenv-ops:<model>@<substrate>
Role: admin

CI evidence:
- collaborator-gate: pass (run #...)
- lint-required: pass
- All required checks green
```

Rerun any failed gates after posting:

```bash
gh run rerun <run-id> --failed
```

**Transition**:

```bash
gh issue edit N --remove-label "status:testing,role:admin" --add-label "status:review,role:consultant"
```

## 4. Consultant Phase

**Entry**: Issue at `status:review`. All CI gates green.

Post an independent critique and closeout on the **issue** (not the PR):

```
CONSULTANT_CLOSEOUT

Signed-by: <alias>
Team&Model: devenv-ops-consult:<model>@<substrate>
Role: consultant

[independent review — Team&Model must differ from Collaborator's]
```

Then merge the PR:

```bash
gh pr merge N --squash --delete-branch
```

Close the issue atomically with status:done:

```bash
gh issue edit N --remove-label "status:review,role:consultant" --add-label "status:done"
gh issue close N
```

## Reduced Lanes

### docs/research lane (Manager → Consultant only)

For PRs that only change `.md` files, instructions, or research docs:

Post these N/A markers on the issue before creating the PR:

```
COLLABORATOR_HANDOFF: N/A — docs/research lane
ADMIN_HANDOFF: N/A — docs/research lane
```

The CI `baton-gates.yml` reads the issue comments for these strings. N/A markers satisfy
the gate while still enforcing the ≥60 s timing check against their timestamps.

### config-only lane (Admin → Consultant only)

For trivial single-value config changes with no design decision:

```
COLLABORATOR_HANDOFF: N/A — config-only lane
```

## Label Reference

| Status | Active role | Meaning |
| --- | --- | --- |
| `status:triage` | `role:manager` | Manager scoping |
| `status:ready` | none | Awaiting Collaborator |
| `status:in-progress` | `role:collaborator` | Implementation active |
| `status:testing` | `role:admin` | CI gates running |
| `status:review` | `role:consultant` | Critique and closeout |
| `status:done` | none | Closed — terminal |

## Forbidden Combinations

- `status:done` on an open issue — done must coincide with `gh issue close`
- Any `role:*` label on a closed issue
- `status:backlog` or `status:done` with any `role:*` label
- Skipping a role without posting an explicit N/A marker

## Quick Reference

```bash
# Check what the baton-gates CI expects
gh issue view N --json comments -q '[.comments[].body | select(contains("HANDOFF") or contains("CLOSEOUT"))]'

# See all checks on a PR
gh pr checks <PR-number>

# Rerun only failed checks
gh run rerun <run-id> --failed
```
