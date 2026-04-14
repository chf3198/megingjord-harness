---
name: Global Engineering Standards
description: Always-on standards for root-cause fixes, evidence-based claims, secret hygiene, and automation-first execution.
applyTo: "**"
---
# Global Engineering Standards

## Ticket-first governance

- No code or config work without a linked GitHub issue (ticket-first gate).
- Every commit message must reference `#N` (issue number).
- Branch naming: `<type>/<issue#>-<slug>` (e.g., `feat/62-multi-ticket-baton`).
- Research tickets skip branching — findings posted as ticket comments.
- Pull latest `main` into feature branch before creating PR (pull-before-PR).

## Engineering standards

- Prefer root-cause fixes over detection-only band-aids.
- Prefer prevention over reaction: local guardrails first, CI backstops second.
- Never claim build, test, release, or publish success without explicit evidence.
- Keep changes minimal, localized, and reversible.
- Preserve public APIs unless change scope explicitly requires API updates.
- When behavior or interfaces change, update documentation in the same change.
- Never expose secrets in repository files, packaged artifacts, logs, or generated examples.
- Before packaging/publishing, verify exclude rules block secret-bearing files.
- Use placeholders in docs and examples — never live tokens, keys, or credentials.
- Prevention first, detection second: local guardrails before CI backstops.
- For versioned artifacts, enforce version consistency (tag = manifest = changelog).
- Use deterministic checks and objective pass/fail gates whenever possible.
- If evidence is incomplete, state uncertainty and gather missing evidence.
