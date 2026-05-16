# Governance Migration Status

**Goal:** Migrate legacy hand-maintained instruction files into canonical manifest source with generated targets for all orchestrators.

## Current State

**Manifest units (6):** operator-identity-context, team-model-signing, role-baton-routing, global-task-router, governance-controls, harness-goals

**Generated adapters (21 files):** copilot/.github/instructions/ × 6, cline/.clinerules/ × 5, claude-code/CLAUDE.md, continue/.continue/rules/ × 5

**Generated + tracked in git:** ✅ (all 21 files committed)

## Legacy Instructions (29 total)

### Migrated (6)
- operator-identity-context
- team-model-signing
- role-baton-routing
- global-task-router
- governance-controls
- harness-goals

### Pending migration (23)
- authorization-profile-context
- canonical-governance-anti-duplication
- cross-team-consultant
- epic-governance
- feature-completion-governance
- github-governance
- global-standards
- hamr-routing
- ide-proxy
- observability
- playwright-mcp-low-resource
- provider-neutral-governance
- readability-commenting-governance
- release-docs-hygiene
- repo-health-onboarding
- sandbox-worktree-governance
- team-model-in-workflows
- test-methodology-matrix
- ticket-driven-work
- visual-qa-governance
- wiki-knowledge
- workflow-resilience
- (5 more minor)

## Migration Strategy

1. **Phase 1 (complete):** 6 core P1 units (scope, identity, routing, goals, controls)
2. **Phase 2 (next):** Add 5-6 high-frequency governance instructions (auth-profiles, anti-duplication, epic-governance, github-governance, feature-completion)
3. **Phase 3:** Remaining specialized domains (wiki, observability, visual-qa, etc.)

## Validation

- ✅ Manifest schema validates all 6 units
- ✅ Generators produce 21 files (no errors)
- ✅ Parity tests: 5/5 passing
- ✅ Compatibility matrix: 6 units, 4 active targets
- ✅ Golden snapshots: updated
