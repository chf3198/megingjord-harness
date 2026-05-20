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
- Research tickets skip branching; findings posted as ticket comments.
- Pull latest `main` into feature branch before creating PR.

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
- For versioned artifacts, enforce version consistency (tag = manifest = changelog).
- Use deterministic checks and objective pass/fail gates whenever possible.
- If evidence is incomplete, state uncertainty and gather missing evidence.

## Goal-lens decision lint (required)

- Apply this priority order to all governed decisions:
	`G1 Governance > G2 Quality > G3 Zero Cost > G4 Privacy > G5 Portability > G6 Resilience > G7 Throughput > G8 Observability > G9 Interoperability > G10 Maintainability`.
- When tradeoffs occur, explicitly justify why a lower-priority goal overrides a higher one.
- Keep the justification short and evidence-based in ticket comments, PR body, or closeout notes.

## Cross-team GitHub tool surface

- Default to the official GitHub MCP server (`github/github-mcp-server`) for
	cross-team GitHub interactions. Falls back to `gh` CLI when MCP unavailable
	or when `MEGINGJORD_MCP_DISABLED=1` is set.
- See `instructions/github-governance.instructions.md` for the full contract
	and `docs/howto/mcp-server-adoption.md` for the operator guide.

## Decisional vs. actionable (Discussions vs. Issues)

- **Issues**: actionable work with concrete deliverable + acceptance criteria.
- **Discussions**: decisional questions, open design exploration, cross-team
	protocol debates, tooling research — anything without a concrete AC yet.
- When a Discussion crystallizes into a deliverable, convert it to an Issue
	via `gh discussion view N --json` + `gh issue create`. Keep the Discussion
	link in the Issue body so decisional rationale is preserved.
- See `docs/howto/discussions-vs-issues.md` for category catalog and examples.
