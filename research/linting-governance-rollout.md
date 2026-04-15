# Research: Implementation Mechanism — Adoption & Rollout

**Ticket**: #103 | **Epic**: #101 | **Date**: 2026-07-15

## 1. Incremental Adoption Strategy

### Phase 1: Warn-only baseline (Week 1-2)
- Install ESLint+jsdoc in devenv-ops
- All rules at `warn` severity
- Run locally, catalog violations
- No CI gate (informational only)

### Phase 2: Fix violations in devenv-ops (Week 2-4)
- Add JSDoc to 60 JS files (dashboard + scripts)
- Add docstrings to 19 Python hook scripts
- Fix shellcheck warnings in 7 bash scripts
- Graduate rules to `error` after files pass

### Phase 3: CI enforcement (Week 4-5)
- Add `lint:full` to devenv-ops CI
- PRs blocked on lint failure
- Merge to main requires pass

### Phase 4: Roll to home-harbor (Week 5-6)
- Copy shared configs to home-harbor
- Migrate ESLint v8 → v9 flat config
- Warn-only first, then error
- Update CI workflow

### Phase 5: Fleet rollout (Week 6+)
- Template for new repos via repo-onboarding-standards
- Each repo gets shared configs on onboarding

## 2. Deploy Integration

### New npm scripts
```json
{
  "lint:full": "eslint . --config lint-configs/eslint.config.devenv.js && node scripts/lint.js",
  "lint:sync": "node scripts/lint-sync.js"
}
```

### docs-drift-maintenance skill update
Add surface #5 (inline code docs) with verification:
"Lint pass confirms inline documentation exists."

## 3. Cross-Repo Consistency

### Guarantees
1. **Single source**: All configs in devenv-ops `lint-configs/`
2. **Sync script**: `lint-sync.js` compares SHA-256 hashes
3. **CI parity**: Same workflow template across repos
4. **Onboarding**: `repo-onboarding-standards` updated

### Drift Detection
`lint-sync.js` computes SHA-256 of each config file:
- ✅ In sync
- ⚠️ Drift detected (shows diff)
- ❌ Missing (config not present)

## 4. Implementation Summary

| Decision | Choice |
|----------|--------|
| ESLint version | v9 flat config |
| Config location | `lint-configs/` in each repo |
| Deploy mechanism | Copy + hash-based sync |
| CI enforcement | Shared workflow template |
| Adoption | 5 phases, warn→error |
| Resource impact | ~75MB install, <7s runtime |
| Consistency | SHA-256 drift detection |
