# Collaborator pre-handoff checks (#1571)

Before posting `COLLABORATOR_HANDOFF`, the Collaborator agent should run the deterministic check helper and paste the resulting table into the handoff body. Each check is a verifiable evidence statement, not a judgment call. Eliminates the recurring CI re-roll patterns documented across PRs #1558/#1559/#1577.

## Usage

```js
const C = require('./scripts/global/collaborator-self-check.js');
const result = C.runChecks({
  branchName: 'fix/1571-collab-check',
  prBody: '...full PR body...',
  ticketNumber: 1571,
  testStrategy: 'tdd-pyramid',
  prFiles: ['tests/collaborator-self-check.spec.js', 'scripts/global/collaborator-self-check.js'],
  handoffBody: '...full draft COLLABORATOR_HANDOFF body...',
  readabilityWarnings: { baseline: 410, current: 408 },
  managerHandoffBody: '...full MANAGER_HANDOFF body...',
  ownTeamModel: 'claude-code:opus-4-7@anthropic',
  prospectiveAdminTeamModel: 'claude-code:sonnet-4-6@anthropic',
  labels: [],
});
console.log(C.formatChecks(result));
```

## The 10 checks

| ID | Verifies |
|---|---|
| `branch-name-prefix` | Branch matches `feat\|fix\|hotfix\|chore\|skill` prefix regex. See `[[feedback-branch-name-prefix]]`. |
| `refs-this-ticket-first` | First plain `Refs #N` line in PR body matches the branch ticket. See `[[feedback-refs-ordering-in-pr-body]]`. |
| `closes-and-refs-both-present` | Both `Closes #N` AND `Refs #N` are in the PR body. |
| `tdd-spec-in-diff-when-required` | If `test_strategy: tdd-pyramid` declared, at least one `tests/**/*.spec.{js,ts}` is in the PR file list. See `[[feedback-baton-artifact-format-pitfalls]]`. |
| `no-prose-colon-collision` | No prose `Team&Model: <value>` or `test_strategy: <value>` collision outside the signature block. See `[[feedback-team-model-prose-collision]]`. |
| `no-markdown-bold-on-test-strategy` | `test_strategy:` declared plain text, no markdown bold around the field name. |
| `flaw-marker-citations` | Any `flaw\|bug\|failure\|incident` mention has a `#N`/`incidents.jsonl`/`pattern_id:`/`anneal_tickets_filed:`/`memory/` citation within ±2 lines. |
| `readability-no-new-warnings` | Post-change readability count is `<=` pre-change baseline. |
| `all-acceptance-criteria-ticked` | Every `- [ ]` or `- [x]` in `MANAGER_HANDOFF` acceptance section has a corresponding `- [x]` in `COLLABORATOR_HANDOFF`. |
| `model-diversity-prospective-admin` | Your `Team&Model` differs from the prospective Admin's per Epic #1568 AC-3 critical-path rule. |

## Skip path

Apply label `collaborator-self-check:waived` on the PR (or linked issue) to skip the advisory entirely. Use sparingly — typically for solo-agent ships where the rule itself is the deliverable, or for hotfix flows where the handoff is composed under time pressure.

## CI advisory

`.github/workflows/collaborator-self-check-advisory.yml` runs on every PR open/sync, reads the linked issue's `COLLABORATOR_HANDOFF`, and posts a structured advisory comment if the `Pre-handoff verification` section is missing. **Does not block merge during the soak window** — promotion to required-blocking is a separate follow-on after 7 days zero false-positives (Epic #1486 Path D pattern, parity with #1554, #1555, #1572).
