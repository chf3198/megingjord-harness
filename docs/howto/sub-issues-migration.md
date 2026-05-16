# Sub-issues Migration

GitHub's native **Sub-issues** primitive replaces the prose-level
`Refs Epic #N` convention for parent/child relationships.

## Why move off `Refs Epic #N` prose

- **Trap class**: prose `Refs Epic #N` collides with closeout-schema regex
  scans (per `[[feedback-team-model-prose-collision]]`, `[[feedback-role-colon-prose-collision]]`).
  Codex Team #1614 hardens the parser; this migration sidesteps prose entirely.
- **No automatic rollup**: prose `Refs` gives no parent-completion percentage.
- **No native UI**: GitHub UI doesn't surface prose `Refs` as a tree.

## Sub-issues capabilities (per #1624 F3 research)

- Up to 100 children per parent.
- 8 levels of nesting.
- Native REST + GraphQL APIs.
- Issue Types (Bug / Task / Feature / Epic) attach independently of relationships.
- Progress rollup automatic.

## Migration plan (children of #1631)

| Phase | Ticket | Scope |
|---|---|---|
| 1 (this ship, AC3) | #1631 | Update instructions to reference Sub-issues |
| 2 | #1631 AC1 follow-on | Enable Sub-issues + Issue Types on org/repo (Settings op) |
| 3 | #1631 AC2 follow-on | `scripts/global/sub-issue-link.js` pure helper |
| 4 | #1631 AC4 follow-on | Migration script for closed Epics (run-once) |
| 5 | #1631 AC5 follow-on | Update `closeout-schema` to prefer Sub-issue link |
| 6 | #1631 AC6 follow-on | Test suite |

## New-Epic recipe (post-migration)

1. Create the Epic issue with `type:epic` label.
2. Create child issues normally.
3. For each child, link via GraphQL mutation:

```graphql
mutation AddSubIssue($issueId: ID!, $parentId: ID!) {
  addSubIssue(input: { issueId: $issueId, parentIssueId: $parentId }) {
    subIssue { id number title }
  }
}
```

Or via the `sub-issue-link.js` helper (follow-on #1631 AC2):

```bash
node scripts/global/sub-issue-link.js --parent 1604 --child 1655
```

4. The native UI now shows the child under the Epic's sub-issue list.
5. Closeout-schema (after AC5) reads the native relationship; prose-scan
   fallback retained for legacy Epics.

## Backward-compatibility note

- Pre-existing Epics with `Refs Epic #N` children continue to work via the
  closeout-schema prose-scan path; no migration is mandatory.
- The one-time migration script (AC4 follow-on) walks closed Epics and
  emits Sub-issue links so historical data is queryable in the native UI.

## Portability (per G5 contract, #1628)

- **Resource**: GitHub API (same baseline as Issues). No new credential.
- **Opt-out**: not needed — air-gapped operators have no GitHub access at
  baseline, so neither prose `Refs` nor Sub-issues work for them.

## Related

- #1631 — parent ticket (this migration)
- #1614 — Codex Team parser-level prose-collision hardening (composes with this)
- #1628 — G5 Portability contract
- #1624 — research source (F3)
- `instructions/role-baton-routing.instructions.md` (parent/child section)
- `instructions/epic-governance.instructions.md` (Epic-child linkage section)
