# GitHub Features for Governance Hardening

**Ticket**: #60 | **Date**: 2026-04-14 | **Status**: Complete

## Summary Table

| Category | Key Feature | Plan (Private) | Impact |
|---|---|---|---|
| Rulesets | Branch/tag/push rules | Pro | HIGH |
| Status Checks | Required CI gates | Pro | HIGH |
| CODEOWNERS | Auto-review assignment | Pro | HIGH |
| Issue Forms | YAML structured intake | Free | HIGH |
| Projects v2 | Automations, custom fields | Free | MEDIUM |
| Merge Queue | Serialized merge | Org-only | LOW |
| GitHub CLI | Scriptable governance | Free | HIGH |
| Actions | Workflow enforcement | Free (3k min) | HIGH |
| Webhooks/API | External automation | Free | MEDIUM |

## Report Structure

| Section | File |
|---|---|
| Rulesets & Protection | [01-rulesets.md](01-rulesets.md) |
| Checks & CODEOWNERS | [02-checks-codeowners.md](02-checks-codeowners.md) |
| Issue & PR Templates | [03-templates.md](03-templates.md) |
| Projects & Merge Queue | [04-projects.md](04-projects.md) |
| CLI Governance | [05-cli.md](05-cli.md) |
| Webhooks & API | [06-webhooks-api.md](06-webhooks-api.md) |
| Plan Availability | [07-plan-matrix.md](07-plan-matrix.md) |
| Sources | [08-sources.md](08-sources.md) |
| Recommendations | [09-recommendations.md](09-recommendations.md) |

## Critical Finding

As a **personal Pro** repo, devenv-ops gets rulesets, branch
protection, CODEOWNERS, required reviewers, 3k Actions min.
**No** merge queue, org-wide rulesets, or metadata rules.
