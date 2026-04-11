# ADR-001: Skills as Versioned Code

**Status**: Accepted
**Date**: 2026-04-11

## Context

Global Copilot skills live in `~/.copilot/skills/` as untracked local files.
Changes are invisible, untestable, and can't be rolled back.
Skills govern agent behavior across every repository on the machine.

## Decision

Version all skills in `devenv-ops/skills/` with git.
Use sync/deploy scripts to move between repo and runtime location.
Skill changes follow branch→test→merge→deploy workflow.

## Consequences

- **Pro**: Full history of skill changes, ability to diff and rollback
- **Pro**: Can test skill changes on a branch before deploying
- **Pro**: Same skills can be deployed to multiple machines
- **Con**: Extra step to deploy after merge (mitigated by deploy script)
- **Con**: Repo copy may drift from runtime copy (mitigated by sync script)
