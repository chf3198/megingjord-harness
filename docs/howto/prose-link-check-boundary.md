# Prose link check — governance boundary (#3297)

Audit #3296 (AC3) surfaced ~14 broken relative `.md` links inside genuine hand-authored
prose docs that no guardrail caught. This doc names the adjacent guardrails so the seam
does not reopen.

## Three guardrails, three non-overlapping surfaces

| Guardrail | Owns | Does NOT own |
|---|---|---|
| **docs-anchors** (`scripts/global/docs-anchors.js`) | doc→**code** anchors (`<!-- anchor: path#Lx -->` kept in sync with source) | prose→prose `.md` links |
| **prompt-artifact-lint** (`scripts/global/megalint/prompt-artifact-lint.js`, #3302) | structural quality of **prompt artifacts** (`skills/**/SKILL.md`, `agents/**`, `.claude/commands/*.md`) — links, frontmatter, stub bodies | prose docs |
| **prose-link-check** (this, `scripts/global/megalint/prose-link-check.js`) | relative `.md`→`.md` links in **prose docs** (docs/, instructions/, research/, wiki/wisdom/) | doc→code anchors, prompt-artifact structure |

`docs-health-detector` (#3298) is adjacent but orthogonal: it flags **orphan** (no inbound
reference) and **stale** prose docs — not link *validity*.

## What this checker checks

- For each prose `.md` file under `docs/`, `instructions/`, `research/`, `wiki/wisdom/`,
  every Markdown link `[text](target)` whose `target` is a **relative `.md` path** must
  resolve on disk (after stripping any `#fragment` / `?query` suffix).
- **Skipped**: external links (`http(s):`, `mailto:`, `tel:`, `data:`), pure `#anchors`,
  and non-`.md` relative targets (images, code — owned by other checkers).

## Excluded surfaces (and why)

`wiki/work-log/` and `wiki/code/` are **auto-generated mirrors** (GitHub ticket/PR mirrors
and code-symbol maps produced by the #2055 ingest / auto-update pipeline). A broken link
there is a *generator* defect: hand-fixing it regresses on the next regeneration, so it is
out of scope for this checker and owned by the pipeline (root-cause-at-generator, not a
hand band-aid). The checker scans only hand-authored prose.

## Running it

```bash
npm run prose-link:check            # advisory: scans the prose set, exits 0
node scripts/global/megalint/prose-link-check.js --json     # machine-readable findings
node scripts/global/megalint/prose-link-check.js --strict   # non-zero exit on findings
```

CI wiring: `.github/workflows/prose-link-check.yml` runs the advisory form on PRs touching
the prose surfaces. Promotion to a blocking gate is **replay-eval-gated** (precision ≥ 0.85
against the historical-PR corpus), never calendar-gated, per the harness replay-over-soak
pattern.
