---
title: "Documentation Modernization Strategy for DevEnv Ops"
type: synthesis
created: 2026-04-29
updated: 2026-04-29
tags: [documentation, strategy, harness, developer-experience, governance]
related: [
  "[[documentation-excellence-2026-04-29]]",
  "[[help-best-practices]]",
  "[[wiki-pattern]]",
  "[[devenv-ops-enforcement-architecture]]"
]
status: mature
---

# Documentation Modernization Strategy for DevEnv Ops

## Executive Summary

DevEnv Ops harness currently has four separate documentation surfaces (README, HELP/Dashboard, Wiki, Agent Instructions) that drift independently. Synchronizing them using **Divio's four-layer model** + **Google style guide** + **Karpathy wiki pattern** will reduce onboarding friction, prevent docs-code misalignment, and enable agents to learn from documentation. Expected ROI: 40% faster maintainer onboarding, zero docs-drift issues, and increased wiki usage for agent reasoning.

## Problem Statement

### Current State (Fragmented)

| Surface | Owner | Freshness | Audience |
|---|---|---|---|
| **README.md** | Human + CI | ✓ Good (gated on release) | Deployers |
| **HELP (dashboard)** | Human (manual) | ✗ Drifts (no gate) | End-users |
| **CLAUDE.md / AGENTS.md** | Git automation | ✓ Good (versioned) | Agents |
| **Wiki** | LLM + human | ✓ Good (indexed) | Agents + researchers |
| **GitHub profile (About)** | Manual | ✗ Stale | GitHub visitors |
| **Agent instructions** | Human | ? Unknown (no lint) | Copilot/Codex runtime |

### Pain Points

1. **Onboarding bottleneck**: New maintainers must discover docs by trial (where's the sandboxing guide? → grep wiki manually → 20 min).
2. **HELP-code divergence**: Dashboard shows an old CLI flag after script was renamed; user gets confused.
3. **Wikipedia sprawl**: Rich research exists in wiki but no automated link from HELP → relevant wiki page.
4. **Style inconsistency**: README uses "launcher branch," Agent instructions say "sandbox starter." Users confused.
5. **No freshness SLA**: Instructions may reference deleted scripts; no CI check.

### Business Impact

- **Slower onboarding** → Fewer external contributors
- **Docs-code misalignment** → Support burden ("why doesn't the docs example work?")
- **Underutilized wiki** → Agents can't find concepts they need to learn
- **GitHub visibility** → Profile looks unmaintained (no recent "About," no topics); fewer stars/forks

## Solution Design

### 1. Unified Documentation Architecture

```
devenv-ops/
├── README.md                    # Tutorial: Get started (Divio)
├── CONTRIBUTING.md              # How-to: Contribute & governance (Divio)
├── docs/
│   ├── STYLE-GUIDE.md          # Explanation: Terminology & voice
│   ├── ARCHITECTURE.md         # Explanation: System design
│   ├── HELP-GUIDELINES.md      # How-to: Write good HELP text
│   └── DECISIONS/               # Explanation: ADRs
├── instructions/               # Agent instructions (curated, fresh)
├── wiki/
│   ├── index.md                # Searchable concept catalog
│   ├── sources/                # Digests of research
│   ├── concepts/               # Distilled patterns
│   └── syntheses/              # Cross-cutting insights
└── dashboard/
    └── js/help-*.js            # HELP panels with wikilinks
```

**Single source of truth per layer**:
- **Tutorials** → `README.md` + dashboard onboarding flow
- **How-to** → `instructions/` + wiki syntheses (e.g., "How do I use sandbox worktrees?")
- **Reference** → Agent definitions (frontmatter extracted to API reference) + CLI help snapshots
- **Explanation** → `docs/ARCHITECTURE.md` + wiki concepts + ADRs

### 2. Style Unification

**Domain terminology** (all docs must use these consistently):
- **Launcher branch** (not "sandbox starter" or "entrypoint")
- **Baton** (role handoff protocol; not "workflow" or "pipeline")
- **Skill** (Copilot plugin; not "extension" or "tool")
- **Sandbox** (worktree + launcher branch; not just "branch")
- **Epic** (GitHub issue type; not "feature group" or "initiative")

**Voice**: Clear, direct, second-person (inherit Google style).

**Examples**: Every concept page must have a working example.

### 3. Automated Sync & Drift Detection

**CI gates**:

```yaml
# Check 1: README version matches code
- README claims "Install: npm run deploy:apply"
- CI verifies: npm run deploy:apply exists in package.json
- Fail if: script renamed/deleted and README not updated

# Check 2: HELP ↔ Code sync
- Dashboard HELP says "Audit sandbox branches"
- CI verifies: worktree-governance-audit.js still present
- Fail if: script deleted but HELP not updated

# Check 3: Wiki index consistency
- wiki/index.md claims 62 pages
- CI verifies: exactly 62 *.md files in wiki/
- Warn if: orphan pages or unindexed files

# Check 4: Agent instructions freshness
- instructions/sandbox-worktree-governance.instructions.md
- CI verifies: Last commit <90 days ago OR linked to PR
- Warn if: Stale without active maintenance
```

**Docs drift detector** (standalone npm script):

```bash
npm run docs:lint
# Output:
# ✓ README version consistent
# ✓ HELP text matches CLI
# ✓ Wiki index complete
# ✗ instructions/stale-feature.md last updated 120 days ago
# ✓ GitHub topics accurate
```

### 4. HELP Panel Modernization

Current HELP:
> "Run sandbox audit: node scripts/global/worktree-governance-audit.js --json"

Modern HELP with wiki integration:
> "**Sandbox Audit**
> 
> Validate sandbox branch freshness & detect drift.
> ```bash
> npm run governance:worktrees
> ```
> 
> ⓘ Learn more: [[sandbox-worktree-governance]]
> 
> **When to use**: After switching sandbox worktrees; before merging PRs."

Dashboard renders wikilink as clickable modal or sidepanel pull from wiki.

### 5. GitHub Profile Sync

Update repository **About** section:

**Current** (implied from README):
> "Governance-first AI agent harness"

**Target**:
> "🤖 Governance-first AI agent harness for Copilot, Claude Code, Codex — sandbox isolation, ticket-driven workflows, baton-based role routing. Deploy to ~/.copilot/, ~/.codex/, ~/.agents/skills/. 📚 [Wiki](./wiki/) 🏗️ [Architecture](./docs/ARCHITECTURE.md)"

**Topics** (currently empty):
- `ai-agents`
- `governance`
- `copilot`
- `codex`
- `devops`
- `harness`
- `github-actions`
- `agile`
- `typescript`

### 6. Phased Rollout

| Phase | Effort | Impact | Timeline |
|---|---|---|---|
| **1: Style Guide + GitHub Sync** | L (2-3 days) | Medium (clarity, visibility) | Week 1 |
| **2: HELP ↔ Wiki Linkage** | M (4-5 days) | High (discoverability) | Week 2 |
| **3: Docs Drift Detector + CI** | M (5-7 days) | High (reliability) | Week 3 |
| **4: Design Docs & ADRs** | L (3-4 days) | Medium (architecture understanding) | Week 4 |

## Acceptance Criteria

- [ ] `docs/STYLE-GUIDE.md` created; all key terms defined with examples
- [ ] GitHub profile "About" updated; all 7+ topics added
- [ ] Dashboard HELP includes ≥5 wikilinks to related concepts
- [ ] CI gate enforces: README examples are executable (tested in `npm test`)
- [ ] CI gate enforces: HELP text references actual scripts/features
- [ ] `npm run docs:lint` catches ≥80% of common drift patterns
- [ ] Wiki index updated to reference all design docs
- [ ] Onboarding checklist created; new maintainers follow it
- [ ] Zero "docs drift" issues reported in first 30 days post-launch

## Success Metrics

- **Onboarding velocity**: Measure time from first session to first merged PR (target: -40%)
- **Documentation freshness**: No stale instruction files; all links valid (target: 100%)
- **wiki discoverability**: Track "visited via HELP → wiki" events in dashboard telemetry (target: ≥20% of help interactions)
- **Contributor satisfaction**: Survey maintainers on docs clarity (target: 4.5/5.0 NPS)
- **Docs-code alignment**: CI passes consistently (target: 0 sync failures per 100 commits)

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Docs maintenance burden increases | Automate drift detection; assign one owner per section |
| Wiki gets outdated | Add "Last reviewed" frontmatter; CI warns if >3 months old |
| Style guide too prescriptive | Share draft with team; iterate (don't ship immutable) |
| Dashboard HELP rendering breaks | Test wikilink rendering in E2E tests |

## Implementation Roadmap

1. **Epic 601** opens: "Update DevEnv Ops Harness Documentation"
2. **Story 601.1**: Create style guide + sync GitHub profile
3. **Story 601.2**: Add wiki references to HELP panels
4. **Story 601.3**: Implement docs drift detector & CI gates
5. **Story 601.4**: Write design docs & architecture library
6. **Epic closes**: All child stories done; docs-lint passes; GitHub profile updated

---

## Related Work

- [[help-best-practices]] — HELP panel UX patterns
- [[wiki-pattern]] — Karpathy LLM wiki structure
- [[devenv-ops-enforcement-architecture]] — How governance rules are enforced
- [[documentation-excellence-2026-04-29]] — Full research report on modern doc strategies

## Team&Model

- **Human alias**: curtisfranks
- **Team&Model**: GitHub Copilot + GPT-5.3-Codex
- **Created**: 2026-04-29
- **Status**: Ready for epic translation
