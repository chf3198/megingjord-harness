# Pre-Merge Review Severity Gates (#1742)

Defines what each severity tier (low / medium / high) does to the PR merge flow.

## The 3 tiers

### `low` — annotate, no block

- Aggregator posts an advisory PR comment with the findings list.
- No CI failure; PR remains mergeable.
- Marker: `<!-- pre-merge-review:low -->` for deduplication on retrigger.
- Operator can ignore; finding is logged to `~/.megingjord/pre-merge-review.jsonl` for telemetry.

### `medium` — block, waivable

- Aggregator posts the findings + sets the workflow status to `failed` (after Phase 4 promotion; advisory during soak).
- PR cannot merge until either:
  1. Findings addressed (next push retriggers review with `medium → low/none`), OR
  2. Operator applies label `pre-merge-review:waived-with-rationale` + posts a rationale comment.
- Rationale comment must include: structured field `WAIVER_RATIONALE:` + reason; signed by an agent whose `Team&Model` family differs from BOTH the Collaborator AND the original reviewer.
- The waiver requires a 3rd-family signer to prevent collusion.

### `high` — block, require escalation

- Aggregator posts the findings + sets workflow status to `failed` (after Phase 4; advisory during soak).
- PR cannot merge until ONE of:
  1. Findings addressed (next push retriggers review with severity ≤ medium), OR
  2. A 5th-family agent emits an approving `HIGH_SEVERITY_OVERRIDE` artifact with structured rationale, OR
  3. A human (real GitHub user, not bot) approves via standard GitHub PR review.
- High-severity overrides are logged in `~/.megingjord/high-severity-overrides.jsonl` for audit.

## Waiver semantics for `medium`

Format of the required rationale comment:

```
WAIVER_RATIONALE
finding-ids: <comma-separated finding IDs from REVIEWER_FINDINGS>
reason: <1-3 sentence justification>
acknowledged-risk: <what the operator accepts>

Signed-by: <human-alias>
Team&Model: <team:model@substrate>  # must differ from collab AND reviewer family
Role: <admin|consultant>
```

The waiver Signed-by field's team is checked against:
- Manager's team
- Collaborator's team
- Reviewer's team

The waiver signer's team must NOT match any of these (the 3rd-family rule).

This composes with #1716's existing waiver patterns:
- `model-diversity:waived` (#1572 legacy) — soft waiver, advisory only
- `rotation-required-waived` (#1716 v2) — required-mode rotation waiver
- `pre-merge-review:waived-with-rationale` (NEW) — medium-severity findings waiver

## Escalation paths for `high`

### Path A: 5th-family agent approval

For 4-family operators (per #1722 `strict-rotation` mode), a 5th family is
not always available. In practice this path applies when the operator can
route to OpenRouter, LiteLLM, or another aggregator that exposes a model
family not yet used in the baton flow.

Approval artifact format:

```
HIGH_SEVERITY_OVERRIDE
finding-ids: <comma-separated>
rationale: <why these high-severity findings are acceptable>
reviewed-diff-sha: <commit SHA the reviewer examined>

Signed-by: <human-alias>
Team&Model: <team:model@substrate>  # 5th family
Role: high-severity-overrider
```

### Path B: human approval

Real GitHub user (not bot) submits an APPROVE review via the standard PR UI.
The pre-merge-review workflow detects human approval on PR-review-event and
skips its block for the current SHA.

If new commits are pushed after the human approval, the workflow re-runs;
human approval expires per-SHA (standard GitHub semantics).

## Composition with existing harness gates

| Existing gate | Interaction with pre-merge-review |
|---|---|
| `model-diversity-advisory` (#1572) | Both can fire on same PR; orthogonal (identity vs substance) |
| `rotation-advisory` (#1716, soak active) | Both fire; rotation enforces who, pre-merge-review enforces what |
| `closeout-schema` | Reads `REVIEWER_FINDINGS` artifact as part of baton-trail validation |
| `evidence-completeness` | Considers reviewer-step as one of the baton artifacts checked for ≥60s race-aware-sequencing |
| `baton-gates` | Admin signer must differ from Collaborator signer (existing); reviewer signer must also differ from Collaborator (new Rule 4) |

## Configuration

- Phase 3 default: all 3 tiers advisory-only.
- Phase 4 (#1756) day-14 decision determines whether `medium` and `high`
  promote to blocking.
- Per-repo operator override: `MEGINGJORD_PRE_MERGE_REVIEW_MODE=advisory|enforcing`
  env var honored at workflow time.

## Cross-references

- Existing waiver patterns: #1572 (model-diversity:waived), #1716 (rotation-required-waived).
- Phase 3.1 (#1752) helper consumes this severity-gate spec.
- Phase 3.2 (#1753) workflow YAML implements the block/advisory toggle.

## Out of scope

- Implementing the orchestrator severity merge — Phase 3.1 (#1752).
- Implementing the 5th-family routing — Phase 3.2 (#1753) workflow YAML.
- UI for human approval — uses standard GitHub PR review UI.

## Related

- Epic #1736
- Contract spec #1741
- Phase 3 consumers: #1752, #1753
