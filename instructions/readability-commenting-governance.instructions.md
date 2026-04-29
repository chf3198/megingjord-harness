---
applyTo: "dashboard/**/*.js,scripts/**/*.js,tests/**/*.js,hooks/scripts/**/*.sh"
---

# Readability & Commenting Governance

## Purpose
Apply consistent readability and documentation quality across all harness-managed repos.

## Required Standards

1. **Formatting**
   - Use repository formatter command before commit.
   - Avoid manual formatting churn in unrelated files.

2. **Naming**
   - No ambiguous one-letter names except narrow local loops.
   - Name variables/functions by intent, not implementation detail.

3. **Function Complexity**
   - Keep functions small and focused.
   - Split mixed-responsibility functions into helpers.

4. **Magic Numbers**
   - Extract non-obvious constants to named identifiers.
   - Inline only obvious literals (`0`, `1`, small local bounds).

5. **Commenting/JSDoc**
   - JSDoc required for exported/public symbols.
   - Inline comments explain *why*, not restate *what*.
   - Document non-obvious error handling and retry behavior.

6. **Suppressions**
   - Keep suppressions as narrow as possible.
   - Include rationale in adjacent comment.

## Rollout Model

- Stage 1: warn + autofix for legacy files.
- Stage 2: block regressions on touched files.
- Stage 3: enforce strict gates repo-wide after baseline reduction.

## Validation

- `npm run lint:readability`
- `npm run lint:js`
- formatter check command

## Language-Specific Notes

- **JavaScript**: exported functions/classes require JSDoc with params/returns when applicable.
- **Shell**: include intent comments before destructive operations and retries.
- **Markdown**: prefer concise sections, explicit action items, and no stale TODO lists.

## Before/After Examples

- Naming: `const d = getData();` → `const deviceData = getData();`
- Magic number: `setTimeout(fn, 5000)` → `const HEALTHCHECK_TIMEOUT_MS = 5000; setTimeout(fn, HEALTHCHECK_TIMEOUT_MS)`
- JSDoc: undocumented exported function → exported function with purpose/param/return contract.
