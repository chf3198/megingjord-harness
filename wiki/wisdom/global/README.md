# Wiki C scope=global — Operator-Global Research-Based-Wisdom Wiki

Cross-project wisdom that applies across multiple repositories or to general LLM-agent-governance practice. Per the Three-Wiki typology from research/three-wiki-typology-synthesis-1943.md.

## Purpose

House research and synthesis that is REUSABLE across projects. Examples:
- Branch vs worktree vs sandbox isolation patterns (applies to any multi-agent workspace)
- Root-cause vs symptom-suppression principle (applies to any CI/alerting design)
- 2026 industry citations + design principles that any harness could adopt
- Cross-cutting analyses of agentic patterns

## Scope

**Per-project authoring location, COMMITTED in this repo, DISTRIBUTED to operator-global `~/.copilot/wiki/`** on Megingjord deploy. Other repositories on the same operator's machine read the distributed copy as a read-only knowledge source.

## Subdirectories

(Empty until follow-on physical-migration ticket — see "Legacy paths" below)

Designed layout (per #1943 synthesis):
- `concepts/` — Cross-project concept pages
- `entities/` — Cross-project entity pages (services, tools, frameworks)
- `syntheses/` — Cross-project synthesis pages

## Legacy paths (pre-migration)

The following directories at `wiki/<dir>/` (one level up) ARE conceptually Wiki C scope=global content but live at their legacy paths pending the physical migration:

- `wiki/concepts/` → will move to `wiki/wisdom/global/concepts/`
- `wiki/entities/` → will move to `wiki/wisdom/global/entities/`
- `wiki/sources/` → will move to `wiki/wisdom/global/sources/`
- `wiki/syntheses/` → will move to `wiki/wisdom/global/syntheses/`
- `wiki/skills/` → will move to `wiki/wisdom/global/skills/`

**Physical migration deferred to follow-on ticket** (filed at #2051 closeout). The migration requires updating `scripts/wiki/*.js` path-pattern matching, validator regression, and Megingjord deploy/distribution scripts — too invasive for a single docs-research lane ticket.

## Status

**Phase-1 stub** — created by #2051. Physical migration deferred. Until migration completes, treat `wiki/concepts/`, `wiki/entities/`, etc. AS this directory.
