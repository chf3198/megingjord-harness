# Recommendations for devenv-ops

Context: **personal Pro** repository (private). Rulesets, branch
protection, CODEOWNERS, required reviewers. No merge queue.
3,000 Actions minutes/month.

## Priority 1 — Implement Now

1. **Rulesets for `main`**: Require PR, status checks (lint,
   test), block force push, restrict deletions, linear history.

2. **`.github/CODEOWNERS`**: Auto-request review on all changes.
   ```
   * @curtisfranks
   skills/ @curtisfranks
   dashboard/ @curtisfranks
   ```

3. **Issue forms** (`.github/ISSUE_TEMPLATE/`): bug_report.yml,
   feature_request.yml, skill_change.yml, config.yml to disable
   blank issues. Required fields enforce completeness.

4. **PR template** (`.github/pull_request_template.md`):
   Checklist — lint passed, tests passed, docs updated, issue
   link, change type classification.

5. **Governance Actions workflow**: Lint on PR, auto-label on
   issue open. Required status check gates merge.

## Priority 2 — Next Sprint

6. Branch naming enforcement via Actions `create` event
7. Projects v2 board with auto-add + custom fields
8. Scheduled governance audit workflow (weekly cron)
9. `gh` CLI aliases for common governance operations
10. Deploy gate — require lint+test before deploy:apply

## Priority 3 — Future

11. Org migration (unlocks merge queue, team reviewers)
12. Signed commits evaluation
13. Webhook integration for external audit logging
14. Code scanning ruleset (if GHAS becomes available)

## What NOT to Pursue (Plan Limitations)

- ❌ Merge queue (requires organization)
- ❌ Org-wide rulesets (requires Enterprise)
- ❌ Metadata restrictions (Enterprise)
- ❌ Team-based required reviewers (requires org + teams)
- ❌ Push rulesets for private repos (requires Team plan)

## Next Steps

1. Create branch `feat/governance-hardening`
2. Add CODEOWNERS, issue forms, PR template, Actions workflow
3. Configure rulesets via GitHub UI or API
4. Set up Projects v2 board with automations
