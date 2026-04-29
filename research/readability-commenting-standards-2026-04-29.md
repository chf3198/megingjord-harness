# Readability & Commenting Standards Research

**Date**: 2026-04-29

## Summary Table

| Profile | Formatter | Linter | Comment/JSDoc | Cost | Risk |
|---|---|---|---|---|---|
| Minimal | Prettier | ESLint core | Basic JSDoc checks | Low | Medium drift |
| Balanced | Prettier | ESLint + readability rules | JSDoc required on exported/public symbols | Low-Medium | Low |
| Strict | Biome or Prettier+ESLint strict | Full strict rules | Near-total JSDoc coverage + sentence checks | Medium | High migration friction |

## Recommended Profile

**Balanced** is the best default for DevEnv Ops Harness global rollout.

- Keeps cost low (fast local checks + staged CI checks).
- Improves readability quickly without blocking all legacy code immediately.
- Supports progressive hardening with a ratchet model.

## Detailed Findings

### 1) Formatting baseline
- Prettier is still the most compatible cross-repo formatter.
- Biome is faster and compelling, but parity/migration risk is higher in mixed legacy repos.
- Recommendation: keep Prettier as baseline now; evaluate Biome behind opt-in pilot.

### 2) Lint architecture
- ESLint flat config is current standard and supports scoped config per path.
- Existing repo already uses ESLint v9-style configuration patterns.
- Recommendation: centralize a harness-shared readability config and deploy through install assets.

### 3) Commenting & JSDoc policy
- `eslint-plugin-jsdoc` provides modern flat config and granular rulesets.
- Overly strict JSDoc requirements on all functions creates boilerplate risk.
- Recommendation: require JSDoc for exported/public APIs first; permit targeted local exceptions.

### 4) Governance and cost controls
- Autofix-first rollout reduces review cost.
- Ratcheting thresholds reduce migration shock.
- Fast local checks + full CI checks minimize developer idle cost.

## Proposed Standards (Initial)
- Deterministic formatting required (`format:check`).
- No single-letter variables outside narrow loop/local contexts.
- Function-size limit with documented exceptions.
- Magic-number extraction required except obvious literals (0, 1, 2 in local contexts).
- JSDoc required on exported/public functions and modules with non-obvious behavior.

## Sources
- https://prettier.io/docs/
- https://eslint.org/docs/latest/use/configure/configuration-files
- https://github.com/gajus/eslint-plugin-jsdoc
- https://biomejs.dev/
- https://google.github.io/styleguide/jsguide.html

## Actionable Next Steps
1. Implement policy docs in repo instructions (#579).
2. Wire formatter/readability/JSDoc gates with staged strictness (#580, #583).
3. Run dashboard/scripts remediation in controlled waves (#581, #582).
4. Add weekly readability drift report to global governance jobs.

**Last updated**: 2026-04-29
