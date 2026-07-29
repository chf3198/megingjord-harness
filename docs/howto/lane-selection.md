# Lane-selection decision table (Epic #3576 W-B, #3583)

Validators are already lane-aware (E2); the gap this closes is Manager lane-**selection**
guidance. `scripts/global/lane-selector.js#recommendLane({diffLines, touchedPaths, riskLabels})`
codifies the table below. Advisory guidance — not enforcement.

| Signal | Recommended lane |
|---|---|
| Risk label (`area:hooks`, `area:infra`, `security`, `lane:security-surface`, `priority:P1`) | `lane:code-change` |
| Diff > 100 lines, OR > 3 files touched, OR unknown (0 paths) | `lane:code-change` |
| All paths trivial (`*.md`, `*.txt`, README/CHANGELOG, lockfile) AND ≤ 20 lines | `lane:trivial` |
| All paths config (`*.json/yaml/toml/ini`, `config/`) AND ≤ 30 lines | `lane:config-only` |
| Otherwise | `lane:code-change` |

## Batching (multi-close)
When qualifying siblings share a deliverable surface (per the #1714 Multi-Close contract),
`scripts/global/batch-block-generator.js#buildBatchBlocks({lead, siblings, teamModel})` emits
the lead PR's `Closes #N` lines and each sibling's brief-evidence closeout block ("resolved as
part of batch with #<lead>"). This is what the governance anchor now references — bundling is
allowed **per the #1714 contract**, not flatly forbidden (resolves E4).
