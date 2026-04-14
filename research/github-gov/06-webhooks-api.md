# Webhooks & API for Governance

## Webhooks

Subscribe to repository events via HTTP POST:
- Near real-time notifications
- Scales better than API polling
- Available at repo, org, or app level

**Governance-relevant events:**
- `push`, `pull_request`, `pull_request_review`
- `issues`, `issue_comment`
- `branch_protection_rule` (created/edited/deleted)
- `check_run`, `check_suite`
- `deployment`, `deployment_status`
- `merge_group`, `repository` (created/deleted/archived)

## REST API

Standard HTTP verbs for CRUD. Rate: 5,000 req/hr authenticated.

**Governance endpoints:**
- `GET/POST /repos/{owner}/{repo}/rulesets`
- `GET/PUT /repos/{owner}/{repo}/branches/{branch}/protection`
- `POST /repos/{owner}/{repo}/statuses/{sha}`
- `GET /repos/{owner}/{repo}/codeowners/errors`
- `POST /repos/{owner}/{repo}/dispatches`

## GraphQL API

Single-endpoint query language for precise data retrieval.
Essential for Projects v2 (item fields, status updates are
GraphQL-only operations).

## `repository_dispatch` Pattern

Trigger workflows from external systems:
```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"event_type":"governance-check"}' \
  https://api.github.com/repos/OWNER/REPO/dispatches
```

This enables webhook → Actions governance pipelines.
Available on all plans. No restrictions.
