# Rulesets & Branch Protection

## Rulesets (Modern — Recommended)

Named lists of rules for branches, tags, or push operations.
Up to 75 rulesets per repository.

**Available rules:**
- Restrict creations — only bypass users create branches/tags
- Restrict updates — only bypass users push to matching refs
- Restrict deletions — prevent branch/tag deletion (default on)
- Require linear history — enforce squash/rebase only
- Require deployments to succeed — gate on deploy environments
- Require signed commits — GPG/SSH signature verification
- Require pull request before merging — configurable approvals
- Require status checks — CI gates (strict or loose)
- Block force pushes — prevent history rewriting (default on)
- Require code scanning results — GHAS code scanning gate
- Restrict file paths — block pushes changing specific paths
- Restrict file extensions — block specific file types
- Restrict file size — enforce max file size per commit
- Restrict file path length — max path character limit

**Advantages over branch protection:**
1. Multiple rulesets apply simultaneously (rule layering)
2. Statuses: Active, Disabled (no delete needed)
3. Read access users can view active rulesets (audit)
4. Rule layering: most restrictive version wins
5. Push rulesets apply to entire fork network

**Plan availability:**
- Public repos: GitHub Free
- Private repos: GitHub Pro, Team, Enterprise
- Push rulesets: Team plan (internal/private repos)
- Org-wide rulesets: Enterprise only
- Metadata restrictions: Enterprise only

## Branch Protection (Legacy)

Older mechanism with key limits:
- Only ONE rule per branch at a time
- Admins bypass by default (opt-in to enforce on admins)
- No statuses — must delete to disable
- Less audit visibility (requires admin access to view)

**Settings:** Require PR reviews, status checks, conversation
resolution, signed commits, linear history, merge queue,
deployments, lock branch, restrict push, force push, deletions.

**Recommendation:** Migrate to rulesets. Strictly superior.
