# GitHub CLI Governance

## Key Governance Commands

```bash
# Issue management
gh issue create --title "..." --body "..." --label "bug"
gh issue edit NUMBER --add-label "triage"
gh issue list --label "needs-review" --state open
gh issue close NUMBER --reason "not planned"

# PR management
gh pr create --title "..." --base main --head feat/x
gh pr review NUMBER --approve
gh pr merge NUMBER --squash --delete-branch
gh pr checks NUMBER --watch  # Wait for CI

# Workflow management
gh workflow run WORKFLOW.yml -f key=value
gh run list --workflow=ci.yml --status=failure
gh run watch RUN_ID

# Repository management
gh repo edit --enable-auto-merge
gh repo edit --default-branch main

# Ruleset management (via API)
gh api repos/{owner}/{repo}/rulesets

# Labels & Releases
gh label create "governance" --color "#0E8A16"
gh release create v1.0.0 --generate-notes
```

## Auto-label Pattern (Actions)

```yaml
- run: gh issue edit "$NUMBER" --add-label "$LABELS"
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    GH_REPO: ${{ github.repository }}
    NUMBER: ${{ github.event.issue.number }}
    LABELS: triage
```

## PR Validation Script

```bash
TITLE=$(gh pr view $PR_NUMBER --json title -q .title)
if [[ ! "$TITLE" =~ ^(feat|fix|docs|chore)\/ ]]; then
  echo "PR title must match convention"
  exit 1
fi
```

## gh Aliases for Governance

```bash
gh alias set governance-check \
  'pr checks --watch --fail-fast'
gh alias set triage-issues \
  'issue list --label triage --state open'
```

CLI is available on ALL plans. Full governance scripting.
