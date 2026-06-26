# Merge-time Documentation Governance

This runbook describes how the harness enforces documentation across four surfaces at merge time. Phase-1 of Epic #2148. Fleet-model-readable: short paragraphs, concrete examples, no nuanced interpretation required.

## 1. Goal

Every change merged to `main` documents itself across four parallel surfaces. The documentation is enforced by hard gates (CI required-checks + pre-merge validators) rather than relying on agent instruction-following. The system works with non-frontier fleet models that cannot reliably parse multi-page nuanced instructions.

## 2. The four surfaces

| # | Surface | Example | Validator |
|---|---|---|---|
| 1 | GitHub Issues | Every merge has `Closes #N` + complete baton trail on the issue | `closeout-schema` workflow, `baton-gates` |
| 2 | Release notes | Each `lane:code-change` PR ships `.changes/unreleased/<N>.md` | `changelog-fragment-presence` validator (#2157 / C5) |
| 3 | Project docs | README, design docs, dev guide — updated per area-label coverage matrix | `doc-coverage` **hard block** (#2712, lane-derived #3016) + Tech-Writer sub-phase (#2154 / C1) |
| 4 | Wikis | `wiki/code/`, `wiki/wisdom/project/`, `wiki/work-log/` — updated when scoped | `wiki-lint-gate` workflow (#2156 / C3) |

## 3. The pre-merge gates

| Surface | Gate | Failure mode | Remediation |
|---|---|---|---|
| Issues | `baton-gates` CI | Missing handoff or role-mismatch | Post the missing baton artifact in canonical format |
| Release notes | `changelog-fragment-presence` | No `.changes/unreleased/<N>.md` and no `[skip-changelog]` | Add `.changes/unreleased/<N>.md` or marker |
| Project docs | `doc-coverage` **hard block** | Missing `doc-coverage:` block in COLLABORATOR_HANDOFF (on a gated lane) | Add block declaring UPDATED/N-A per surface |
| Wikis | `wiki-lint-gate` advisory | wiki:lint reports issues | Currently advisory; promoted to required after baseline cleanup |

## 4. The Tech-Writer sub-phase

Before posting COLLABORATOR_HANDOFF on a `lane:code-change` ticket, include a `doc-coverage:` block:

```yaml
doc-coverage:
  UPDATED: README.md — describes new flag
  UPDATED: CHANGELOG fragment — see .changes/unreleased/N.md
  N/A: design docs — internal-only validator; no public surface change
```

The validator (`scripts/global/megalint/doc-coverage.js`) parses the block. The gate is now a **hard block** (#2712; the old `DOC_COVERAGE_GATE_ADVISORY` escape hatch was removed). The lane is **derived from the issue labels** (#3016), so a builder-produced handoff is gated correctly. A missing or incomplete block on a gated lane **fails the merge**.

Lanes that skip the gate: `lane:docs-research` and `lane:config-only` (no required project-doc surface). The #3121 diff-verification check — declared `UPDATED` surfaces must actually appear in the PR diff — ships advisory-first and promotes per the replay-eval-gated model.

## 5. The doc-coverage matrix

`config/doc-coverage-matrix.yml` maps `area:*` labels to required + suggested surfaces. Example:

```yaml
surfaces:
  area:governance:
    required:
      - .changes/unreleased/
      - docs/workflow/learnings.md
    suggested:
      - wiki/wisdom/global/concepts/
```

To extend: add a new area-label entry. Validator picks it up on next run.

## 6. Skip markers

| Marker | When legitimate |
|---|---|
| `[skip-changelog]` in PR body | Trivial PRs warranting no changelog entry (typo, formatting, dep lockfile bump) |

Skip markers are auditable — they appear in the PR body and are logged in `doc_coverage_event` audit trail.

## 7. Audit trail

All doc-coverage decisions emit `doc_coverage_event` entries to `~/.megingjord/incidents.jsonl`:

```json
{"ts":"2026-...","version":3,"event":"doc_coverage_event","ticket":"#N","validator":"doc-coverage","verdict":"pass","surfaces_required":["..."]}
```

Schema: `scripts/global/event-schema-v3.js`. PII-redacted via `scripts/global/log-redaction.js`. Query via `jq '.event=="doc_coverage_event"' ~/.megingjord/incidents.jsonl`.

## 8. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `changelog-fragment-presence: FAIL missing-fragment` | No `.changes/unreleased/<N>.md` | Create fragment OR add `[skip-changelog]` to PR body |
| `doc-coverage-advisory` warning | COLLABORATOR_HANDOFF lacks `doc-coverage:` block | Add block per template in section 4 |
| `wiki-lint-gate` advisory failed | Pre-existing baseline drift in wiki/ | Currently advisory only; admin tracks baseline cleanup separately |
| `baton-gates: artifact-role-mismatch` | Stale or malformed baton artifact on issue | Delete stale comments; re-post canonical artifacts (see [[feedback-baton-governance-iterates-all-comments]]) |

## See also

- Round-5 design rationale: see [[Epic #2148 round-5 comment]] for agent-speed-lens scope decisions
- Phase-0 research synthesis: see [[Epic #2148 Phase-0 #2149]]
- Related instructions: `instructions/release-docs-hygiene.instructions.md`, `instructions/role-baton-routing.instructions.md`, `instructions/wiki-knowledge.instructions.md`

Refs Epic #2148. Refs #2159.
