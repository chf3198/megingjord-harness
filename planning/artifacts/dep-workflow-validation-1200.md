# Dependency Workflow Validation (#1200)

**Date**: 2026-05-09
**Artifact**: Collaborator validation evidence for Epic #1125 AC9
**Scope**: Aggregator, augmentor, review CLI, render, and audit integration

## Fixture

The validation used a controlled issue-pair fixture in `/tmp/dep-workflow-1200`
so the run could prove operator acceptance without touching live #1130 or #1133
implementation work.

| Issue | Title | Role |
| --- | --- | --- |
| `#2101` | Build dependency JSON contract | Upstream contract work |
| `#2102` | Render dependency JSON contract | Consumer of the contract |

The augmentor used an injected classifier response to avoid provider spend while
exercising the same proposal path:

- proposed edge: `#2101 depends-on #2102`
- confidence: `0.91`
- rationale: rendering consumes the JSON contract

## Commands

```bash
node scripts/global/dep-graph-aggregate.js
node scripts/global/dep-graph-augment.js
printf 'a\n' | node scripts/global/dep-proposals-review.js \
  --graph /tmp/dep-workflow-1200/dep-graph.json \
  --proposals /tmp/dep-workflow-1200/dep-proposals.json \
  --decisions /tmp/dep-workflow-1200/dep-decisions.json
node scripts/global/dep-graph-render.js \
  --graph /tmp/dep-workflow-1200/dep-graph.json \
  --proposals /tmp/dep-workflow-1200/dep-proposals.json \
  --decisions /tmp/dep-workflow-1200/dep-decisions.json \
  --out /tmp/dep-workflow-1200/dependencies.md \
  --json /tmp/dep-workflow-1200/dependencies.json
node scripts/global/governance-audit.js
```

## Results

| Check | Evidence |
| --- | --- |
| graph generated | `graph_nodes: 2`, `graph_edges: 0` |
| proposal generated | `proposals: 1` |
| operator review accepted | first review `reviewed: 1`, `persisted: 1` |
| rerun idempotence | second review `reviewed: 0`, `persisted: 0` |
| visualization represented acceptance | Mermaid includes `proposal:accepted; 0.91` |
| audit represented health | `dependency_health.status: ok` |
| pending queue clear | `pending_count: 0`, `stale_count: 0` |
| cycle health clear | `cycle_count: 0`, `warnings: []` |

Rendered excerpt:

```mermaid
graph TD
  N2101["#2101 Build dependency JSON contract"]
  N2102["#2102 Render dependency JSON contract"]
  N2101 -.->|depends-on [proposal:accepted; 0.91]| N2102
```

## Acceptance Mapping

- End-to-end run produced graph, proposal, review decision, visualization, and
  audit evidence.
- One accepted missing dependency appeared in final rendered outputs and JSON.
- Re-running the review workflow did not duplicate proposals or decisions.
- Validation touched no #1130 or #1133 implementation files; only this evidence
  artifact is added to the repository.
- Consultant closeout must rate Epic #1125 against all nine harness goals after
  Admin evidence is complete.

## Docs Drift

`docs/howto/dependency-graph.md` already describes the aggregate, augment,
review, render, and audit commands. This ticket validates the documented path
without adding new CLI behavior, so no operator doc update is required.

## Team&Model

Signed-by: Nova Harper
Team&Model: codex:gpt-5@codex-cli
Role: collaborator
