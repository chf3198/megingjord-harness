# Rule-Card Schema

## Purpose

`config/governance-rules.yaml` is a content-addressed registry of harness
governance rules. Each entry is a **rule-card** that captures where a rule
lives, its typological class, its severity, and (for enum-typed rules) its
allowed values.

Refs #2301 (Epic #2295 Phase-1 P1.2).

## Rule-card fields

| Field | Type | Description |
|---|---|---|
| `rule_id` | string | Unique kebab-case identifier |
| `class` | enum | One of 8 typological classes (see below) |
| `statement` | string | One-sentence rule statement |
| `source` | string | Repo-relative path to the authoritative source |
| `enum_values` | list | Allowed values for enum-typed rules; empty otherwise |
| `severity` | enum | `advisory`, `soft-mandatory`, or `hard-mandatory` |
| `cross_runtime_applicability` | list | Runtimes this rule applies to |

## Typological classes

| Class | Meaning |
|---|---|
| `doc-vs-enforcement` | Doc says X but gate enforces something different |
| `enforcement-vs-enforcement` | Two gates enforce conflicting values |
| `enum-drift` | Enum in code differs from enum in docs |
| `doc-vs-no-enforcement` | Rule documented but entirely unenforced by any gate |
| `authority-carve-out` | Rule has an explicit exception/carve-out path |
| `cross-runtime-fragmentation` | Rule applies differently across runtimes |
| `maintenance-drift` | Gate was once enforced but removed or relaxed |
| `context-substituting-for-guardrail` | Context substitutes for a hard gate |

## Severity levels

- `advisory` — violation produces a warning; no gate blocks.
- `soft-mandatory` — violation produces a blocking advisory; easy to override.
- `hard-mandatory` — violation produces a CI-blocking gate failure.

## Extraction

The extractor in `scripts/global/rule-card-extractor.js` implements eight
typological adapters that walk the harness file tree and emit rule-cards:

1. `extractFromInstructions` — parses `instructions/*.md` for HTML-comment
   blocks and fenced ` ```rule-card ``` ` blocks.
2. `extractFromTemplate` — parses `.github/` templates for annotated enums.
3. `extractFromWorkflow` — parses `.github/workflows/*.yml` for `types:` enums.
4. `extractFromValidator` — extracts `const NAME = [...]` arrays from
   `scripts/global/megalint/*.js` and `scripts/global/*.js`.
5. `extractFromHook` — extracts `NAME = [...]` from `hooks/scripts/*.py`.
6. `extractFromPrecommit` — extracts command names from `lefthook.yml`.
7. `extractFromConfigSchema` — extracts `enum:` arrays from
   `config/*.schema.json`.
8. `extractFromLabels` — queries live GitHub label list (best-effort).

Run extraction: `npm run gov:extract` — writes to `/tmp/rule-cards.json`.

## Adding a new rule-card

Append to `config/governance-rules.yaml` following the existing schema.
Run `node scripts/global/rule-card-extractor.js --all` to verify the new
card is well-formed. Tests in `tests/rule-card-extractor.spec.js` validate
schema invariants automatically.
