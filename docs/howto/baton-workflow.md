# Developer HOWTO: End-to-End Baton Workflow

Step-by-step guide for taking a task from user request to closed ticket.
Refs #639 #335

## Overview

Every change in Megingjord goes through a single-threaded baton sequence. One role is
active at a time per ticket. The GitHub issue IS the baton.

Execution `role:*` labels indicate the active baton holder on active states only.
Terminal and waiting states carry no execution role label.

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

**Post scope comment** with objective, ACs, constraints, and overlap boundary references. Include these required fields before the signature block:

```
related_tickets: [#N, #N, ...]
overlap_decision: <boundary decision>
```

End it with:

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

doc-coverage:
  <surface-1>: DONE — <evidence or path>
  <surface-2>: N/A — <reason why not applicable>
```

The `doc-coverage:` block is **required** for `lane:code-change` tickets when
area labels mandate surfaces (see `config/doc-coverage-matrix.yml`). Each line
lists a required surface path-prefix and its status (`DONE` or `N/A — reason`).
Set `DOC_COVERAGE_GATE_ADVISORY=1` to revert to advisory mode. Refs #2424.

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

Runtime-deploy sync verification (per #1105 D-006):
- npm run sync:codex      → ok / N/A — reason
- npm run sync:claude     → ok / N/A — reason
- npm run hamr:sync-verify → ok / N/A — reason
```

**Sync-verification rule** (per `instructions/feature-completion-governance.instructions.md`): for changes that touch deployed runtime artifacts (`~/.copilot/`, `~/.codex/`, `~/.agents/skills/`, HAMR Worker), Admin closeout MUST include the three sync-verify outputs above. For wiki-only / research / docs changes that don't deploy, state explicitly: `sync-verification: N/A — change does not touch deployed runtime targets.`

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

### docs/research lane (Manager → Collaborator → Admin → Consultant)

Docs/research changes still follow the four-role baton unless the ticket is explicitly
classified as no-code remediation.

### no-code remediation lane (Manager → Consultant)

Use this only for issue/thread metadata repair with zero repository file changes.

Required issue markers:

```
COLLABORATOR_HANDOFF: N/A — no-code remediation lane
ADMIN_HANDOFF: N/A — no-code remediation lane
```

### config-only lane (Manager → Admin → Consultant)

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
- `status:backlog` or `status:done` with any `role:*` label — **except Epics**, which carry `role:manager` throughout their lifecycle (label-lint Rule E2; per Epic #1074)
- `status:dormant` or `status:deferred` on non-Epic tickets (Rule E5)
- Skipping a role without posting an explicit N/A marker

## Board Filter Guidance

Use this board filter for active baton work:

```
status:triage,status:ready,status:in-progress,status:testing,status:review
```

Use this filter for queue/terminal ownership hygiene:

```
status:queued,status:backlog,status:done,status:cancelled
```

## Rollout Announcement + Operator Checklist

Announcement text:

```
Ownership semantics rollout: execution role labels now represent only active baton
holders. Waiting and terminal states do not carry execution role labels. Historical
ownership is reporting metadata, not a ticket role label.
```

Operator checklist:
- Verify no closed ticket carries any execution `role:*` label
- Verify waiting states (`backlog`, `queued`, `ready`) carry no execution role labels
- Verify active states carry the matching execution role label
- Verify board filters separate active baton work from queue/terminal hygiene

## Quick Reference

```bash
# Check what the baton-gates CI expects
gh issue view N --json comments -q '[.comments[].body | select(contains("HANDOFF") or contains("CLOSEOUT"))]'

# See all checks on a PR
gh pr checks <PR-number>

# Rerun only failed checks
gh run rerun <run-id> --failed
```

## Doc-coverage is an enforced Collaborator-gate prerequisite (#3016)

For `lane:code-change` work, the `COLLABORATOR_HANDOFF` MUST include a `doc-coverage:`
block before the baton advances — this is a hard `collaborator-gate` check, not advisory.
List every required surface for the ticket's `area:*` label (see `config/doc-coverage-matrix.yml`)
as either `UPDATED/DONE: <path>` or `N/A — <reason>` where `<reason>` is from the approved
enum (e.g. `no-user-visible-change`, `covered-by-sibling-pr`, `docs-only-no-functional-change`).
Freeform N/A reasons fail the gate. A genuine legacy bypass requires `LEGACY_DOC_SKIP` set
**and** a `BLOCKER_NOTE` on the linked issue.

## Per-review-point flaw capture: `flaws_recognized:` (#3428, Epic #3425)

Every baton artifact (MANAGER / COLLABORATOR / ADMIN / CONSULTANT) carries a `flaws_recognized:`
block — a bare `none` or one entry per disposed candidate (`decision:` ∈ the `judgment-gate.js`
`FLAW_DECISIONS` enum; `artifact:` decision-typed: `#N` / `pattern_id` / memory-path / rationale).
This generalizes the Consultant-only `mid_flight_flaws` to every role so flaw recognition is captured
at each review-point, not only at closeout. Validator `scripts/global/megalint/flaws-recognized.js`
ships **ADVISORY** (warns, never blocks) until the replay-eval promotion gate (#3434). See
`instructions/role-baton-routing.instructions.md` §"Flaw-recognition anneal decision".

The detection layer that *feeds* the block (Epic #3425, #3429/#3431/#3432): a per-review-point
checkpoint (`review-point-checkpoint.js`) fires at each baton-artifact build, surfacing the friction
candidates accumulated since the previous review-point so the role can dispose of them. Friction
sensors (`friction-sensors.js`) emit F2 (retry loops) and F5 (revert/amend/discard) candidates; the
SessionEnd audit from #1855 is now the **backstop** (`anneal-decision-backstop.js`) that catches
review-points which crashed or bypassed the builder. F6 asserted-vs-observed probes
(`asserted-vs-observed-probes.js`) falsify artifact claims with cheap read-only probes — including a
squash-aware worktree probe (content-equivalence via `git cherry`, so a squash-merged branch is never a
false positive); only high-confidence (pure-local) probes are blocking-eligible, network probes stay
advisory. The none-vs-candidate reconciler (`none-vs-candidate-reconciler.js`) closes checkbox-fatigue: a
`flaws_recognized: none` is valid only against a zero (or un-escalated-low-severity) candidate feed — a
`none` contradicted by a medium/high candidate is a violation (3+ same-`pattern_id` low-sev escalate to
medium; medium-confidence F6 never blocks). All advisory until the P1-g replay-eval promotion gate.
