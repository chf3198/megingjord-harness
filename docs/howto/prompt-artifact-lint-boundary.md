# Prompt-artifact lint — governance boundary (#3302)

Audit #3296 surfaced a governance seam: broken relative links and structural defects
inside skill/agent prompt artifacts (`skills/**/SKILL.md`, `agents/**`,
`.claude/commands/*.md`) went uncaught because no guardrail owned their *structure*.
This doc names the three adjacent guardrails so the seam does not reopen.

## Three guardrails, three non-overlapping surfaces

| Guardrail | Owns | Does NOT own |
|---|---|---|
| **eval-harness** | The *behavior* of a skill/agent — does the prompt produce the intended result | The artifact's link/frontmatter/body structure |
| **doc-coverage / drift-lint** | *Prose docs* — `docs/**`, `instructions/**`, `wiki/**`, README/community-health, and prose docs *about* skills | The prompt artifacts themselves |
| **prompt-artifact-lint** (this) | *Structural quality* of the prompt artifacts — broken relative links, missing/empty `name`/`description` frontmatter, stub/header-less bodies | Behavior (eval-harness) and prose docs (doc-coverage) |

Skills and agents are **eval-harness prompt artifacts**, not Technical-Writer doc
surfaces (per memory `doc_audit_excludes_prompt_artifacts` and the
test-methodology matrix). They are therefore excluded from prose doc audits — but
their *structure* still needs a deterministic check, which this linter provides.

## What the linter checks

- **Broken relative links** — `[text](path)` whose relative target does not exist.
  External links (`http(s):`, `mailto:`, `tel:`, `data:`) and pure `#anchor` links
  are skipped.
- **Missing/empty frontmatter** — `name` and `description` on authored persona
  definitions: `SKILL.md` and `*.agent.md`. Agent prompt *fragments*
  (e.g. `agents/pre-merge-review/*.md`), reference docs, and JSON rosters are exempt.
- **Stub bodies** — empty or header-less artifact bodies.

## The `.claude/commands/*.md` deploy-copy rule

`.claude/commands/*.md` are flattened deploy-copies of `skills/<name>/SKILL.md`
(frontmatter stripped, no `references/` sibling dir). A relative link that fails
same-directory resolution is therefore retried against the source skill directory
`skills/<name>/`. This prevents false positives on skill-internal links such as
`references/OWNER-MATRIX.md` (valid in the source skill, absent beside the flat copy)
while still catching links that are broken in *both* locations.

## Running it

```bash
npm run prompt-artifact:lint            # advisory: scans the whole artifact set, exits 0
node scripts/global/megalint/prompt-artifact-lint.js --json   # machine-readable findings
node scripts/global/megalint/prompt-artifact-lint.js --strict # non-zero exit on findings
```

CI wiring: `.github/workflows/prompt-artifact-lint.yml` runs the advisory form on PRs
touching `skills/`, `agents/`, or `.claude/commands/`. Promotion to a blocking gate is
**replay-eval-gated** (precision ≥ 0.85 against the historical-PR corpus), never
calendar-gated, per the harness replay-over-soak pattern.
