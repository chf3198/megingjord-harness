# Discussions vs. Issues: Decisional / Actionable Split

GitHub Discussions hold the **decisional** layer; Issues hold the
**actionable** layer. Conflating them in Issue comments creates noise.

## Decision rule

| Question | Where it goes |
|---|---|
| Should we adopt X? | Discussion |
| What's the right way to model Y? | Discussion |
| Is Z worth shipping? | Discussion |
| Ship X by Y with AC Z | Issue |
| Fix bug N | Issue |
| Update doc M | Issue |

If the question has no concrete deliverable yet, it belongs in a Discussion.
Once a deliverable + AC crystallizes, convert to an Issue.

## Discussion categories (proposed)

| Category | Purpose | Examples |
|---|---|---|
| Architecture | System-level design debate | "Should we split HAMR into multi-region?" |
| Cross-team protocol | Inter-team coordination | "How should claim conflicts be resolved?" |
| Tooling research | Tool evaluation | "Compare gh-aw vs Claude-Code agent-teams" |
| Operations notes | Runbook deltas, op insights | "Pre-push gate hang recovery recipe" |
| Q&A (default) | Quick questions | "How do I run the lint locally?" |

**API constraint** (per #1668 verification): GitHub's GraphQL API does **not**
expose a `createDiscussionCategory` mutation. The 6 default categories
(Announcements, General, Ideas, Polls, Q&A, Show and tell) ship with every
Discussions-enabled repo. The 4 governance-specific categories above
(Architecture, Cross-team protocol, Tooling research, Operations notes) must
be created via the repo **Settings → Discussions** UI by an operator with
admin access. Until then, governance discussions can be filed under
**General** with the category-tag pattern in the title (e.g.,
`[architecture] should we split HAMR...`).

## Conversion path (Discussion → Issue)

When a Discussion crystallizes into a deliverable:

1. Manager-role agent reads the Discussion to extract scope + AC.
2. `gh issue create --title "..." --body "Crystallized from Discussion #N. ..."` with full AC.
3. Comment back on the Discussion: "Crystallized to Issue #M; closing this thread."
4. Close the Discussion (`gh discussion close N`).

The Discussion link in the Issue body preserves the decisional rationale.

## What stays in Issue comments

- Baton artifacts (MANAGER_HANDOFF, COLLABORATOR_HANDOFF, ADMIN_HANDOFF, CONSULTANT_CLOSEOUT).
- AC-progress updates.
- Closeout evidence.

## What does NOT go in Issue comments anymore

- Open architectural debates with no deliverable yet → Discussion.
- "Maybe we should consider X" speculation → Discussion.
- Tool comparisons not tied to a specific ship → Discussion.

## Portability (per G5 contract, #1628)

- **Resource**: GitHub Discussions GA. Same baseline as Issues.
- **Opt-out**: not applicable — operators with Issue access have Discussion
  access by default.

## Implementation children

- AC1 (create the categories on the repo): follow-on filed.
- AC4+ (validator nudges; convert-helper script): follow-on filed.

## Related

- #1633 — parent ticket
- #1624 — research source (F5)
- #1628 — G5 Portability contract
- `instructions/global-standards.instructions.md` (Decisional vs. actionable section)
