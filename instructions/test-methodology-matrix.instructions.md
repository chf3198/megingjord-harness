# Test Methodology Matrix

Architecture drives test shape. TDD is one strategy of many; the right one is determined by surface, not ideology. Manager declares `test_strategy` per `MANAGER_HANDOFF`; `test-evidence` gate verifies the declared evidence artifact exists.

## Surface → strategy

| Surface | Strategy | Lane default |
|---|---|---|
| `scripts/global/*.js`, `scripts/*.js` (governance, signals, pure functions) | `tdd-pyramid` | code-change |
| `cloudflare/**/*.ts` (Worker routes, schema-bearing) | `contract-test` | code-change |
| `dashboard/**/*.{js,html,css}` (UI) | `visual-regression` | code-change |
| `hooks/scripts/*.py` (Python runtime hooks) | `tdd-pyramid` (pytest) | code-change |
| `.github/workflows/*.yml` (CI/CD) | `golden-file` | code-change |
| `agents/**/*.{md,yml,json}`, `skills/**/*.md` (LLM prompts/agents) | `eval-harness` | code-change |
| `instructions/**/*.md`, `wiki/**/*.md`, `docs/**/*.md` | `drift-lint` | docs-research |
| `research/**/*.md`, ADRs | `peer-review` | docs-research |
| Single-value config (toggles, version bumps, limits) | `manual-verify` | config-only |
| Trivial (typo, formatting, link, dependency lockfile) | `none` | trivial |

## Strategy enum (allowed `test_strategy` values)

`tdd-pyramid | tdd-trophy | contract-test | golden-file | eval-harness | visual-regression | drift-lint | peer-review | manual-verify | none`

## Evidence artifact per strategy

| Strategy | Required evidence in PR or issue trail |
|---|---|
| `tdd-pyramid` | New/modified `tests/**/*.spec.{js,ts}` file in PR diff; `npm test` green |
| `tdd-trophy` | Same as pyramid + at least one integration-flavored fixture |
| `contract-test` | Schema assertion in trail OR `tests/**/contract.spec.*` in PR |
| `golden-file` | `tests/fixtures/**` referenced in PR OR fixture diff inline |
| `eval-harness` | Eval fixture path under `tests/eval/**` referenced |
| `visual-regression` | `VISUAL_QA_EVIDENCE` block per `visual-qa-governance.instructions.md` |
| `drift-lint` | `docs-drift-maintenance` skill output cited in trail |
| `peer-review` | `CONSULTANT_CLOSEOUT` with rubric ≥7 per `role-consultant-critique` |
| `manual-verify` | Before/after value + rationale in `ADMIN_HANDOFF` |
| `none` | Permitted only when lane ∈ {trivial, docs-research, docs-only, research, config-only} |

## Goal-lens justification

When matrix recommends a strategy other than `none` and Manager declares `none`, justify per goal-lens priority order (G1 Governance > G2 Quality > G3 Zero Cost > …). Justification goes in `MANAGER_HANDOFF` as a one-line note. `test-evidence` gate emits an advisory comment but does not block — Consultant authority on whether the override is acceptable.

## Soft default

Legacy / pre-rollout tickets without `test_strategy` are treated as `none`. Gate emits a Manager-warning advisory comment but does not fail the lane:trivial / docs path. For lanes requiring evidence, gate fails with link to this matrix.

## When the matrix is wrong

Open a `type:research` ticket against `area:governance` proposing the surface delta. Don't free-hand a new strategy enum value in a `MANAGER_HANDOFF` — the validator's enum is authoritative and rejects unknowns.

## References

- TDD effects mixed: small +external quality, ±productivity (ScienceDirect SLR 2025)
- Trophy (Kent C. Dodds), Diamond, Skyscraper, Crab — architecture-driven shapes (Automation Panda 2025; web.dev "Pyramid or Crab"; Medium 2026)
- LLM-authored code: TestGen-LLM-style backstop after-the-fact (Meta / Qodo, 2024–2026)
- Visual QA: `instructions/visual-qa-governance.instructions.md`
- Goal-lens: `instructions/global-standards.instructions.md`
- Schema: `instructions/role-baton-routing.instructions.md` (`MANAGER_HANDOFF` `test_strategy` field)
