# Projects v2 Cross-Team Coordination

Projects v2 is the live cross-team state plane. Issues remain the canonical
work-tracking primary; Projects v2 is the **live-state overlay** showing who
is working on what right now.

## Board structure

One board per repo, with custom fields:

| Field | Type | Purpose |
|---|---|---|
| `claimed-by` | text | Team currently holding the baton (claude-code / copilot / codex) |
| `locked-paths` | text | Comma-separated file globs the holder has open |
| `in-flight-since` | date | When current claim started |
| `expected-completion` | date | Operator estimate; informs cross-team scheduling |
| `cross-team-stage` | text | `triage`/`in-progress`/`testing`/`review` mirror of issue label |

## Core GraphQL queries

### Query: list in-flight items

```graphql
query InFlight($projectId: ID!) {
  node(id: $projectId) {
    ... on ProjectV2 {
      items(first: 100) {
        nodes {
          content {
            ... on Issue { number title state }
          }
          fieldValues(first: 10) {
            nodes {
              ... on ProjectV2ItemFieldTextValue { text field { ... on ProjectV2Field { name } } }
              ... on ProjectV2ItemFieldDateValue { date field { ... on ProjectV2Field { name } } }
            }
          }
        }
      }
    }
  }
}
```

### Mutation: set claim

```graphql
mutation SetClaim($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: String!) {
  updateProjectV2ItemFieldValue(input: {
    projectId: $projectId, itemId: $itemId, fieldId: $fieldId
    value: { text: $value }
  }) { projectV2Item { id } }
}
```

### Mutation: release claim

Set `claimed-by` to empty string and `in-flight-since` to null via two
`updateProjectV2ItemFieldValue` calls in sequence.

## Baton-flow integration (planned)

- **Manager handoff**: claim board item, set `claimed-by` + `in-flight-since`.
- **Collaborator handoff**: set `locked-paths` from staged diff.
- **Admin handoff**: update `cross-team-stage` to `testing`.
- **Consultant closeout**: release claim (clear `claimed-by`, set `cross-team-stage` to `done`).

Each step is one GraphQL mutation; failures degrade gracefully to issue-comment-only updates.

## Portability (per G5 contract, #1628)

- **Resource**: Projects v2 requires GitHub org access. Every operator with
  Issue access has this.
- **Opt-out**: `MEGINGJORD_PROJECTS_V2_DISABLED=1`. Skills detecting the opt-out
  fall back to issue-comment-only state.
- **Air-gapped fallback**: per #1624 F10, decisions.md pattern is the local
  alternative; see #1636 follow-on.

## Implementation children

- #1630-followup: AC1 (create the board via GraphQL mutation)
- #1630-followup: AC2 (`scripts/global/projects-v2-state.js` pure helper)
- #1630-followup: AC4 (wire helper into baton flow)
- #1630-followup: AC5 (test suite with mock GraphQL responses)
- #1630-followup: AC6 (dashboard read-only panel)

## Related

- `instructions/github-governance.instructions.md` (MCP-server section — these
  GraphQL ops are MCP-callable via `mcp__github__update_project_v2_item_field_value`)
- `docs/howto/mcp-server-adoption.md` (#1629)
- `instructions/harness-goals.instructions.md` G5 (#1628)
