# Wiki Log
Append-only chronological record of wiki operations.
Each entry uses a parseable prefix for CLI filtering.

## Format
```
## [YYYY-MM-DD] operation | Subject
Brief description of what happened.
```

**Tip**: `grep "^## \[" log.md | tail -5` shows last 5 entries.

---

## [2026-04-13] init | Wiki system scaffolded
Phase 1 foundation created. Directories: raw/, wiki/, scripts/wiki/.
Schema: WIKI.md. No sources ingested yet.

## [2026-04-14] ingest | "Karpathy LLM Wiki Pattern"

## [2026-04-14] ingest | DevEnv Fleet Topology

## [2026-04-14] ingest | Copilot Skills System

## [2026-04-14] bulk-ingest | 20 research files → wiki/sources/
Batch ingest of all research/*.md files into wiki source pages.
Files: agent-drift (7), agile-roles (2), copilot-governance,
dashboard-research, free-tier-inventory, hardware-evaluation,
help (2), prompt-reduction, tiered-architecture (2), workflow (2).
Epic #85 ticket #86. Total wiki pages now: 23.

## [2026-04-14] create | 5 entity pages + 5 concept pages
Entities: penguin-1, windows-laptop, openclaw, tailscale-mesh,
copilot-pro. Concepts: baton-protocol, agent-drift,
self-annealing, wiki-pattern, governance-enforcement.
Cross-linked with [[wikilinks]]. Epic #85 ticket #87.
Total wiki pages now: 33.

## [2026-07-14] create | Dashboard Codebase Gold Rules
Synthesis from deep audit of 40 JS files. 10 gold rules
covering namespace isolation, error handling, Alpine v3 API,
Playwright config, script loading. Epic #290.

## [2026-04-23] ingest | LLM Wiki Optimal Implementation Plan
Research synthesis from web sources: Anthropic Claude Code Best Practices
(2026), Mem0 April 2026 memory algorithm, Lilian Weng agent taxonomy,
Karpathy/Lutke context engineering (Jun 2025). Five gaps identified in
current wiki implementation with tiered P0/P1/P2 remediation plan.
Total wiki pages now: 51.

## [2026-04-29] ingest | Documentation Excellence for AI Agent Harnesses
Research synthesis integrating three frameworks: Divio Four-Layer Model
(tutorials/how-to/reference/explanation), Write the Docs best practices
(audience clarity, accessibility, docs-as-code), Google Developer Style Guide
(voice, terminology consistency). Cutting-edge recommendations for agent harness
documentation synchronization. Cross-references: [[help-best-practices]], [[wiki-pattern]].
Total wiki pages now: 63.

## [2026-04-29] create | Documentation Modernization Strategy for DevEnv Ops
Strategic synthesis combining documentation excellence research with DevEnv Ops
specifics. Proposes unified Divio four-layer architecture, style unification,
automated drift detection, HELP ↔ wiki linkage, GitHub profile sync. Four-phase
rollout with CI gates, drift detector npm script, success metrics. Epic-ready brief.
Total wiki pages now: 64.## [2026-04-23] ingest | OpenClaw Windows optimization and alternatives
Research synthesis added from LiteLLM reliability/routing docs, Ollama API,
llama.cpp performance guidance, and LocalAI overview. Captures decision to
keep OpenClaw as control plane and harden endpoint reliability/fallbacks.
Total wiki pages now: 52.

## [2026-04-23] update | Windows OpenClaw endpoint hardening
External IT lane completed on windows-laptop: OpenClaw gateway changed from
loopback `127.0.0.1:18789` to tailnet `100.78.22.13:4000`, restoring fleet
health probe success at `/health` and unblocking harness hardening work.

## [2026-04-23] ingest | Fleet live usage indicator options
Research captured for low-resource live visibility on fleet devices.
Validated on-demand model runtime behavior and recommended terminal-first
indicator with optional browser mirror. Total wiki pages now: 53.

## [2026-04-23] update | Fleet warm-pool guidance
Added validated `keep_alive` warm-pool guidance and clarified that terminal
log/`ollama ps` views provide low-overhead live activity visibility.

## [2026-04-23] update | Fleet indicator UAT stress harness
Implemented single-line terminal rendering to prevent scrollback growth and
added bounded stress scripts (`.sh` and `.js`) for operator UAT validation.

## [2026-04-23] ingest | Global governance self-anneal
Formal governance anneal report added with root-cause/risk analysis and
instruction hardening actions for baton, epic closure, and divergence triggers.
Total wiki pages now: 54.

## [2026-04-23] update | Governance anneal web corroboration
Backfilled external GitHub Docs evidence for issue lifecycle, label governance,
and PR-linked auto-close semantics; updated research and wiki source references.

## [2026-04-23] ingest | Cost→quality self-anneal research
Added web-corroborated cost-benefit analysis for model routing, CI path filters,
concurrency, caching, and selective test execution. Created implementation-ready
task set (#144–#146). Total wiki pages now: 55.

## [2026-04-23] ingest | Governance workflow hardening design
Added web-refreshed governance research for protected branches, merge queues,
and project automation. Finalized design and created implementation tickets
(#151–#154). Total wiki pages now: 56.

## [2026-04-23] ingest | Governance verification harness checklist
Added executable pre-close governance verification script and evidence checklist
for Admin/Consultant closeout phases. Total wiki pages now: 57.

## [2026-04-29] ingest | Sandbox worktree governance pack
Added source+synthesis pages for launcher-branch controls, reset workflow, and merge-group-safe CI governance checks.
Last updated with supporting research and runbook alignment.
