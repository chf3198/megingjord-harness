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

## [2026-04-23] ingest | OpenClaw Windows optimization and alternatives
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

## [2026-04-30] shipped | Sandbox launcher sync (#647)
`.github/workflows/post-merge-sandbox-sync.yml` merged: fires on push to main, force-resets
all sandbox/* branches via GitHub REST API. Closes the "guardian without a keeper" invariant
hole in worktree-governance-required CI gate.

## [2026-04-30] shipped | Governance drift detection (#360)
`scripts/global/governance-drift-classifier.js` + 11-test spec + daily CI workflow merged.
Classifies governance issues into open/terminal/epic drift classes; writes JSON report to
`logs/governance-drift.json`. `npm run governance:drift` for manual runs.

## [2026-04-30] shipped | Fleet remediation runner evidence pack (#595)
`scripts/global/fleet-benchmark-runner.js` + `fleet-rollout-runner.js` confirmed in main
(merged earlier via PR #596 by Copilot team). Issue closed after Claude Code Team verified
2/2 tests pass.

## [2026-04-30] anneal | Wiki critical audit and structural repair (#651)
34 lint violations resolved: frontmatter fixed on 9 pages, ghost index entries removed
(linting-governance-rationale/tooling/rollout), 2 missing pages added to index,
type field pluralisation corrected on 7 pages. Model routing page updated
(Opus 4.6 → 4.7). Index rebuilt with correct page counts (62→65 with new synthesis).

## [2026-04-30] ingest | LLM Wiki state synthesis (2026)
New synthesis page `llm-wiki-state-2026.md` created from web research (16 sources).
Key findings: flat-markdown architecture validated at this scale; 5 improvements
recommended (confidence frontmatter, infra-automation routing, qmd search MCP,
typed wikilinks, frontmatter-only session map). Total wiki pages now: 65.

## [2026-04-30] update | wiki_router.py — infra-automation routing
Added `infra-automation` routing branch: devenv-ops sessions now inject fleet routing
order (from model-routing concept) and governance enforcement layers (from governance-
enforcement concept). Max snippets raised from 4 to 5. Synced to both runtimes.

## [2026-05-01] ingest | Drift Monitoring Strategy 2026-05-01

## 2026-05-01 — Fleet Hardware Optimization #734 ingested
Manual ingest: research/fleet-hardware-optimization-2026-05-01.md → wiki/sources/fleet-hardware-optimization-2026-05-01.md
Cross-linked: 36gbwinresource, openclaw, penguin-1, fleet-architecture, cascade-dispatch, model-routing


## [2026-05-01] ingest | Token Telemetry Capability Matrix (Epic #768 research gate)
Evidence-backed provider capability matrix and unified design synthesis created.
Covers: Anthropic, OpenRouter, LiteLLM, Gemini, Ollama (exact), Copilot (estimated).
Canonical schema and confidence policy defined. Implementation children #769-#774 created.
Total wiki pages now: 66.
