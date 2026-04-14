# Required Checks & CODEOWNERS

## Status Checks

Two types:
1. **Checks** — GitHub Apps, line annotations. Actions uses this.
2. **Commit statuses** — simpler pass/fail from any integration.

**Key behaviors:**
- Skipped jobs report as "Success" — won't block merge
- Checks data retained 400 days, then archived/deleted
- Skip per-commit with `skip-checks: true` trailer
- Pin status checks to specific GitHub App sources

**Strict vs Loose:**
- **Strict**: Branch must be current with base before merge
- **Loose**: Can merge without being current (risk of breakage)

## Actions as Governance Gates

| Event | Use Case |
|---|---|
| `pull_request` | Lint, test, validate PR content |
| `push` | Post-merge validation, deploy gates |
| `issues` | Auto-triage, enforce templates |
| `pull_request_review` | Post-approval automation |
| `merge_group` | Merge queue CI integration |
| `branch_protection_rule` | React to protection changes |
| `schedule` | Periodic governance audits |
| `workflow_dispatch` | Manual governance actions |
| `repository_dispatch` | External system triggers |
| `create` / `delete` | Branch naming enforcement |

Branch/path filtering limits CI scope efficiently.

## CODEOWNERS

Located: `.github/CODEOWNERS` (searched first), root, or docs/.

**Syntax:** gitignore-style patterns with `@username` or `@org/team`.
Last matching pattern takes precedence. Max file size: 3 MB.

**Key rules:**
- Code owners must have write permissions
- File must be on the base branch of the PR
- Any ONE code owner approval is sufficient (not all)
- Case-sensitive paths

**Integration:** Enable "Require review from Code Owners"
in rulesets. Protect the CODEOWNERS file itself:
`/.github/CODEOWNERS @curtisfranks`

**Personal repo limitation:** CODEOWNERS triggers review
requests on all plans. "Required reviewers" via teams needs
org repos. For personal Pro: auto-request works, team-based
required reviews do not.
