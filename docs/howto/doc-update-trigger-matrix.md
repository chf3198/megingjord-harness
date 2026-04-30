# Doc-Update Trigger Matrix

When code in a given area changes, the corresponding documentation surfaces
**must** be updated in the same PR. This matrix is the enforcement spec for
the CI doc-update gate (issue #641).

Generated: 2026-04-30 | Refs #522 #335

## Matrix

| Changed path pattern | Required doc update (at least one) | Rationale |
| --- | --- | --- |
| `skills/**` | `docs/howto/`, `CONTRIBUTING.md`, or `CHANGELOG.md` | Skills are user-facing; gaps accumulate silently |
| `instructions/**` | `docs/howto/`, `CHANGELOG.md`, or `README.md` | Instructions govern agent behavior; stale docs mislead |
| `scripts/global/**` | `CHANGELOG.md` or `docs/howto/` | Global scripts affect routing, telemetry, cost |
| `hooks/**` | `CHANGELOG.md` or `README.md` | Hook behavior is invisible unless documented |
| `.github/workflows/**` | `CHANGELOG.md` or `.github/` doc | CI changes affect all contributors |
| `inventory/**` | `CHANGELOG.md` or `research/` doc | Inventory changes reflect fleet topology shifts |
| `package.json` (scripts) | `CHANGELOG.md` or `README.md` | New `npm run X` commands need surfacing |

## Explicit Exclusions (gate must NOT fire)

| Path pattern | Reason |
| --- | --- |
| `tests/**` | Test changes do not require doc updates |
| `logs/**` | Generated/ephemeral data |
| `research/**` | Research is self-documenting |
| `wiki/**` | Wiki content is its own doc surface |
| `model-compare/**` | Benchmark data; not user-facing |
| `.github/ISSUE_TEMPLATE/**` | Templates are docs themselves |
| `lint-configs/**` | Config only; behavior unchanged unless `npm run lint` output changes |

## Escape Hatch

Add `[skip-doc-gate]` to the PR description body when:

- The change is a typo fix, formatting-only, or test-only within a covered path
- The doc update would be trivial and is covered by the commit message
- A linked issue provides the documentation artifact (add `Doc: #N` to PR body)

The gate checks for the escape hatch token before failing.

## Enforcement Implementation

Gate: `.github/workflows/doc-update-gate.yml` (issue #641)

Logic:
1. Compute `changed_paths` from `git diff --name-only origin/main...HEAD`
2. For each trigger pattern with a match in `changed_paths`, check if at least
   one required doc path also appears in `changed_paths`
3. If a trigger fires with no matching doc update AND no `[skip-doc-gate]` token
   AND no `Doc: #N` reference → fail with actionable message
4. If all triggers satisfied or no triggers fire → pass

## Review Cadence

This matrix should be reviewed whenever a new top-level directory is added to the repo,
or when a new `scripts/global/` entry point is added. The CI gate enforces the matrix,
so updates here must be accompanied by a gate config update.
