# Dependency Graph Aggregation

Use the deterministic dependency graph aggregator to build the Layer 1 graph for
Epic #1125.

```bash
npm run deps:aggregate
```

By default, the command reads GitHub issues through `gh issue list`, parses
explicit relationship lines, and writes:

```text
planning/dep-graph.json
```

For smaller probes or CI fixtures, limit the issue count and write outside the
repo:

```bash
npm run deps:aggregate -- --limit 20 --out /tmp/dep-graph.json
```

The graph includes:

- `nodes`: issue number, title, state, labels, update time, and dependency
  summary metadata when available.
- `edges`: explicit text or GitHub-native dependency edges.
- `mismatches`: same issue pair with conflicting edge types.

The command is read-only against GitHub. It does not mutate issues, labels, or
native dependency relationships.

Generate AI-assisted proposals after the graph exists:

```bash
npm run deps:augment -- --graph planning/dep-graph.json
```

The augmentor writes `planning/dep-proposals.json`, records confidence and
cache metadata, and never mutates issues.

Review generated proposals without mutating GitHub:

```bash
npm run deps:review -- --proposals planning/dep-proposals.json
```

The review command records accepted, rejected, and suppressed decisions in
`planning/dep-decisions.json`. Accepted records keep proposal and issue-title
metadata for later approved mutation tooling. Rejected and suppressed proposals
are tombstoned by cache key until source issue inputs change.

Render the human-readable dependency graph after aggregation and review:

```bash
npm run deps:render
```

The render command writes `planning/dependencies.md` and
`planning/dependencies.json`. The Markdown includes refresh metadata, a Mermaid
graph with edge types and proposal status annotations, critical path summary,
cycle summary, pending proposals, and stale review decisions. It is deterministic
for the same graph, proposal, and decision inputs.

Include dependency health in the daily governance audit:

```bash
npm run governance:audit
```

The audit reads the same graph, proposal, and decision files. It writes
`dependency_health` into `/tmp/governance-audit.json` with cycle count,
critical-path length, unresolved mismatch count, stale proposal age, and
augmentation cost/fallback counters. Missing dependency files produce warnings in
the audit JSON instead of failing the command before aggregation has run. Any
detected cycle is also promoted to a governance violation.

Signed-by: Nova Harper
Team&Model: codex:gpt-5@codex-cli
Role: collaborator
