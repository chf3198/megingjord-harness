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

Signed-by: Nova Harper
Team&Model: codex:gpt-5@codex-cli
Role: collaborator
