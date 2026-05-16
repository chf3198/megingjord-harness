# Auto-Escalate Trigger Matrix Specification (#1743)

Machine-readable trigger matrix that auto-raises pre-merge-review severity to
`high` regardless of agent confidence. Consumes Phase 1.2 research (#1738).

## JSON specification

```json
{
  "version": "1.0.0",
  "triggers": [
    {
      "name": "auth-code-change",
      "type": "path-glob",
      "patterns": [
        "**/*auth*",
        "**/*authn*",
        "**/*authz*",
        "**/middleware/*token*",
        "**/jwt*",
        "**/oauth*"
      ],
      "severity-raise-to": "high",
      "rationale": "auth/authn/authz code changes have high blast radius"
    },
    {
      "name": "db-schema-migration",
      "type": "path-glob",
      "patterns": [
        "**/migrations/*",
        "**/schema/*.sql",
        "**/prisma/schema.prisma",
        "**/*-migration.{js,ts,py,sql}"
      ],
      "severity-raise-to": "high",
      "rationale": "schema migrations are intrinsically high-risk"
    },
    {
      "name": "new-external-dependency",
      "type": "lockfile-diff",
      "files": [
        "package-lock.json",
        "requirements.txt",
        "go.mod",
        "Cargo.lock",
        "Gemfile.lock",
        "yarn.lock",
        "pnpm-lock.yaml"
      ],
      "diff-pattern": "new-package-entry",
      "severity-raise-to": "high",
      "rationale": "new external deps expand the attack surface and supply-chain risk"
    },
    {
      "name": "dependency-version-bump",
      "type": "lockfile-diff",
      "files": [
        "package-lock.json",
        "requirements.txt",
        "go.mod",
        "Cargo.lock"
      ],
      "diff-pattern": "version-bump-only",
      "severity-raise-to": "medium",
      "rationale": "version bumps deserve scrutiny but are less risky than new packages"
    },
    {
      "name": "secret-credential-path",
      "type": "path-glob",
      "patterns": [
        "**/.env*",
        "**/secret*",
        "**/credentials*",
        "**/*.key",
        "**/*.pem",
        "**/keystore/*"
      ],
      "severity-raise-to": "high",
      "rationale": "secret/credential files in PRs are unusual and warrant scrutiny"
    },
    {
      "name": "workflow-yaml-actions-change",
      "type": "path-glob-plus-ast",
      "patterns": [
        ".github/workflows/*.yml",
        ".github/workflows/*.yaml",
        "Dockerfile",
        ".gitlab-ci.yml",
        "Jenkinsfile"
      ],
      "ast-query": "new-action-usage-or-sha-change OR new-run-shell-command",
      "severity-raise-to": "high",
      "rationale": "workflow YAML edits change the CI security surface"
    },
    {
      "name": "workflow-yaml-trivial",
      "type": "path-glob-plus-content",
      "patterns": [".github/workflows/*.yml"],
      "content-query": "only-comment-or-whitespace-changes",
      "severity-raise-to": "low",
      "rationale": "whitelist: trivial workflow YAML edits should not over-fire"
    },
    {
      "name": "cryptographic-primitive",
      "type": "ast-grep",
      "patterns": [
        "import.*crypto",
        "new KeyId\\(",
        "ed25519.*sign",
        "ed25519.*verify",
        "rsa.*\\(.*new"
      ],
      "severity-raise-to": "high",
      "rationale": "new cryptographic primitive usage deserves substantive review"
    },
    {
      "name": "permission-scope-expansion",
      "type": "yaml-diff",
      "files": [".github/workflows/*.yml"],
      "diff-pattern": "permissions-block-write-addition",
      "severity-raise-to": "high",
      "rationale": "expanding workflow permissions enlarges blast radius"
    },
    {
      "name": "test-deletion",
      "type": "diff-pattern",
      "files": ["tests/**", "**/*.spec.*", "**/*.test.*"],
      "diff-pattern": "lines-removed-no-equivalent-added",
      "severity-raise-to": "medium",
      "rationale": "test deletion may indicate coverage loss"
    }
  ],
  "whitelists": [
    {
      "name": "lockfile-checksum-only",
      "applies-to": ["new-external-dependency", "dependency-version-bump"],
      "exception": "diff contains only `integrity:` line updates with no new package entries; downgrade to no-trigger"
    },
    {
      "name": "auth-rename-no-logic-delta",
      "applies-to": ["auth-code-change"],
      "exception": "auth-path file is renamed/moved with no logic change (file content diff is import-path-only updates); downgrade to no-trigger"
    },
    {
      "name": "patch-version-bump-only",
      "applies-to": ["dependency-version-bump"],
      "exception": "version bump under semver tilde/caret with no major/minor change; downgrade severity to low"
    },
    {
      "name": "trivial-workflow-yaml",
      "applies-to": ["workflow-yaml-actions-change"],
      "exception": "only comment or whitespace changes (no `uses:`, `run:`, `with:`, `permissions:` deltas); downgrade to low"
    }
  ],
  "confidence-interaction": {
    "rule": "trigger-hit combines with agent-confidence per:",
    "matrix": {
      "trigger=hit + agent-confidence>=0.7": "use trigger's severity-raise-to value",
      "trigger=hit + agent-confidence=0.3-0.7": "use trigger's severity-raise-to minus one tier (high → medium; medium → low)",
      "trigger=hit + agent-confidence<0.3": "no severity raise; log advisory only"
    }
  }
}
```

## Persistence

Stored at `config/auto-escalate-triggers.json`. Phase 3.3 (#1754) sub-agent
prompts include this matrix; aggregator applies whitelist patterns.

## Cross-reference with existing `area:*` labels

Per #1738 finding: existing area labels (`area:auth`, `area:db`, `area:security`)
do NOT exist. Phase 3 implementation has two options:

- **Option A**: Add new area labels (`area:auth`, `area:db`, `area:security`).
- **Option B**: Use trigger matrix entirely (path-glob based detection).

**Recommended: Option B** — path-glob detection is deterministic and doesn't
require label hygiene. Operators who want explicit categorization can still
apply `area:*` labels for project-board filtering; the trigger matrix
operates independently.

## False-positive mitigation

3-tier confidence interaction (above) is the primary mitigation. Secondary
mitigation: whitelist patterns. Tertiary mitigation: waiver pathway from
#1742 severity-gates spec.

## Per-PR history deduplication

Same PR re-triggering same trigger across iterations counts once (don't pile
up identical findings). Aggregator implementation tracks `(trigger_name,
file, line)` tuples and emits each only once per PR-SHA.

## Out of scope

- Implementing the detector — Phase 3.1 (#1752) orchestrator + Phase 3.3 (#1754) sub-agent prompts.
- Adding new `area:*` labels (Option A above) — recommend operator preference, not Phase 3 scope.

## Related

- Phase 1.2 research #1738
- Phase 2 siblings: #1741 (contract), #1742 (severity gates), #1744 (HAMR integration)
- Phase 3 consumers: #1752, #1754
