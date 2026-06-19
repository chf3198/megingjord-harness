---
name: "docs-drift-maintenance"
description: "Detect and remediate documentation drift after code, config, workflow, or UX changes."
argument-hint: ""
---

# Docs Drift Maintenance

## When to use

- After any change to commands, config, workflows, API/CLI behavior, or release process.
- Before merge/release if docs accuracy is part of acceptance.
- Before declaring a feature complete (not just gates-complete).

## Documentation coverage matrix (required)

For feature-adds and behavior changes, evaluate all applicable surfaces:

1. Local operator docs
   - `README.md`
   - `docs/technical/system-stability.md`
   - `docs/workflow/learnings.md`
2. Public repository docs
   - `.github/CONTRIBUTING.md`
   - `.github/PULL_REQUEST_TEMPLATE.md`
   - community profile files (`CODE_OF_CONDUCT.md`, `SECURITY.md`, `SUPPORT.md`)
3. VS Code extension public profile
   - `vscode-extension/README.md`
   - `vscode-extension/CHANGELOG.md`
   - `vscode-extension/package.json` metadata/settings descriptions
4. Release traceability docs
   - root `CHANGELOG.md`
   - release notes / GitHub release object
5. Inline code documentation
   - **JS/TS**: JSDoc on all exported/public functions (`@param`, `@returns`, `@description`)
   - **Python**: Google-style docstrings on all public functions, classes, and modules
   - **Bash**: Header comment block on each script; inline comments on non-obvious logic
   - **CSS**: Section header comments; non-obvious rule explanations

## Procedure

1. Enumerate changed behavior/config/workflow/code surfaces.
2. Map each change to impacted docs using the coverage matrix above.
3. Identify stale, missing, or contradictory statements.
4. Apply minimal doc deltas that restore correctness and traceability.
5. Verify docs now match actual behavior and invocation paths.
6. Record what was intentionally N/A and why.

## Output format

- `drift_status`: none|found|critical
- `impacted_docs`: file list with reason
- `required_updates`: concrete edits required
- `verification_checks`: objective checks confirming alignment
- `evidence`: code/workflow changes correlated to docs updates
- `not_applicable`: surfaces reviewed but intentionally N/A
