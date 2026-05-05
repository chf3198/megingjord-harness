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

## [2026-05-04] research | HAMR Spike S6 — Build-vs-adopt + STRIDE threat model (#881, EPIC #860)
Two-part deliverable: (a) per-child build-vs-adopt matrix for the 9 surviving
HAMR MVP children — counts ADOPT 2 / BUILD 4 / HYBRID 3 / REUSE 0; one
license-incompatible library flagged (TruffleHog AGPL-3.0, rejected as direct
dep); (b) formal STRIDE threat model across 5 adversary classes × 6 STRIDE
categories — 9 of 30 cells residual MEDIUM or HIGH after existing mitigations.
Four required HAMR design changes (DC-1: signed A2A mailbox envelopes; DC-2:
slsa-verifier pre-MCP-connect; DC-3: hardware-bound DPoP key; DC-4: signed
baton handoff artifacts + non-fleet judge gate). Sources:
research/hamr-spike-s6-build-vs-adopt-2026-05-04.md and
research/hamr-spike-s6-threat-model-2026-05-04.md.

## [2026-05-04] research | HAMR Spike S5 — Distillation rule-coverage (#880, EPIC #860)
Empirical compression-vs-rule-coverage curve for our 22,480-char governance
text. Two methods tested in parallel: deterministic top-k extractive (47-
keyword vocabulary) and Cerebras llama3.1-8b LLM rewrite. Both saturate at
~32% of source size (≈68% tokens saved) before hitting an irreducible-rule
floor. 20-question quiz graded by Cerebras llama3.1-8b scored 20/20 at every
level on both methods. Decision: REVISE v3's ≥97% target upward to ≥99%
keyword-coverage; introduce two-stage gate (cheap keyword + periodic
reasoning-grounded). Source: research/hamr-spike-s5-distillation-2026-05-04.md.

## [2026-05-04] research | HAMR Spike S1 — Existing Code Audit (#876, EPIC #860)
Audit of 20 modules against HAMR v3 13-child MVP plan. Decision counts:
REUSE 3, REFACTOR 11, REPLACE 3, MERGE 3. Revised HAMR child count: 9
(down from 13). Four prospective children absorbed into refactors of
`cascade-dispatch.js`, `model-routing-engine.js`, `litellm-client.js`,
`token-provider-adapters.js`, `wiki/anneal.js`. Three modules slated for
REPLACE: `agent-coord-remote.js`, `cloudflare/worker.ts`,
`cloudflare/durable-object.ts`. Source: research/hamr-spike-s1-code-audit-2026-05-04.md.

## [2026-05-03] update | Token telemetry drift reconciliation (#774)
Implemented and validated reconciliation + alerting harness for request-vs-aggregate token drift.
Added provider lane and confidence-impact fields, dashboard reconcile panel, and test coverage.
Validation evidence captured from capability probe, cloud provider probes, and fleet benchmark
(including 36gbwinresource performance and OpenClaw preflight result).

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

## [2026-05-01] ingest | Multi-Agent Dashboard Design (Epic #742)
Cerebras llama3.1-8b design Q&A: CSS Grid auto-fill layout, N>3 overflow badge, browser-tab-only heartbeat, JSON schema {vendor,agentId,branch,ticket,activity,ts,tier}.
Canonical files: research/multi-agent-dashboard-design-2026-05-01.md → wiki/sources/multi-agent-dashboard-design-2026-05-01.md
Epic #742 closed. PR #777 merged. Version v3.3.0 tagged.

## [2026-05-01] ingest | Token Telemetry Capability Matrix (Epic #768 research gate)
Evidence-backed provider capability matrix and unified design synthesis created.
Covers: Anthropic, OpenRouter, LiteLLM, Gemini, Ollama (exact), Copilot (estimated).
Canonical schema and confidence policy defined. Implementation children #769-#774 created.
Total wiki pages now: 66.

## 2026-05-01 — Paid Token Floor Reduction #782 ingested
Manual ingest: research/paid-token-floor-reduction-2026-05-01.md → wiki/sources/paid-token-floor-reduction-2026-05-01.md

## [2026-05-01] ingest | Fleet Resource Audit + Hardware Optimization
Live fleet audit + hardware optimization findings (post-IT pass 2026-05-01).
Source files: raw/articles/fleet-resource-audit-2026-05-01.md, research/fleet-hardware-optimization-2026-05-01.md, research/multi-agent-command-center-round-2-2026-05-01.md.
Wiki pages: wiki/sources/fleet-resource-audit-2026-05-01.md, wiki/sources/fleet-hardware-optimization-2026-05-01.md, wiki/sources/multi-agent-command-center-round-2-2026-05-01.md.

## [2026-05-02] update | Fleet entities refreshed (#803)
Updated wiki/entities/{36gbwinresource,openclaw,penguin-1}.md to reflect SYSTEM-service Ollama operating mode, current model lineups, and per-request keep_alive: "24h" pattern. Architecture map (docs/ARCHITECTURE.md) and DECISIONS index updated; WIKI.md and wiki-knowledge instruction now document the wiki:ingest pipeline; new docs/howto/contribute-to-wiki.md walks contributors through it.

## [2026-05-02] ingest | Codebase organization 2026-Q2 research (#819)
Source: research/codebase-organization-2026-05-02.md / raw/articles/codebase-organization-2026-05-02.md / wiki/sources/codebase-organization-2026-05-02.md.
Manual ingest (fleet LLM endpoints returning HTTP 400 at ingest time). Spawned implementation children #820, #821, #822 under Epic #818.

## [2026-05-02] audit | Manager-side ticket audit pass (#836, #837 spawned)
Manager-authority audit across 18 open tickets. Deterministic governance scripts reported zero drift. LLM-grounded review (Groq llama-3.3-70b + Cerebras qwen-3-235b, free fleet) surfaced one real doc-drift (epic-governance vs ticket-driven-work contradiction → #836), one ticket-cluster boundary (#732/#766/#833), and one AC-tightening signal (#829). New wiki concept: ticket-audit-pattern. New tickets: #836, #837. Manager comments posted on #732, #766, #829, #833. Token cost: ~8 KB Claude / ~80 KB free fleet.

## [2026-05-03] shipped | Fleet matrix refresh automation + freshness gate (#833)
`scripts/global/routing-refresh.js` probes Groq/Cerebras/OpenRouter/Google + 3 Tailscale Ollama hosts; writes `.dashboard/routing-snapshot.json` + stamps matrix header. `scripts/global/matrix-freshness.js` fails CI on >60d staleness. `.github/workflows/model-matrix-refresh.yml` monthly cron + on-demand. 6 Playwright tests. 36gbwinresource qwen2.5-coder:32b drafted the change-summary section; zero paid LLM tokens.

## [2026-05-03] research | Parallel fleet access — global queue design (#781)
Manager-authority research deliverable for cross-team Tailscale fleet sharing. Decision: SQLite-WAL default substrate (#739) with optional Worker DO (#740/#788). Per-vendor skill/tool surfaces designed for Claude Code, Copilot, Codex, Continue.dev, Cursor, Aider. Heavy fleet usage: Cerebras 235B (Q5-Q10), 36gbwinresource qwen2.5-coder:32b (Q4), Groq llama-3.3-70b (Q1-Q3). Implementation children deferred to client review.

## [2026-05-04] research | Dashboard closed-state hygiene (#852)
Research-only deliverable for child of EPIC #848. Decision: Linear-style default-hide + toggle with Height-style condensed historical attribution. Single Groq llama-3.3-70b dispatch (zero paid LLM tokens). Implementation children NOT spawned — awaiting client review.

## [2026-05-04] research | Dashboard layout density heuristics (#854)
Research-only deliverable for child of EPIC #850. Produced per-panel sizing matrix and desktop/laptop/mobile wireframe baselines with panel consolidation rationale. Heavy fleet usage evidence captured from capability probe + routing refresh + fleet benchmark (36gbwinresource strongest throughput). Implementation children NOT spawned — awaiting client review.

## [2026-05-04] research | Fleet harness-awareness v2 (#863, EPIC #860, supersedes v1 #861)
2199-word revision addressing client's 6 considerations: fleet-agnostic three-tier fallback, bidirectional wiki via GitHub App + Yjs CRDT, multi-repo bound JWT identity, independent substrate-health probe, 9-row per-provider native caching matrix, R2-backed agent mailbox with Google A2A envelope. v1 happy-path substrate preserved; 9 implementation children identified (vs v1's 5). 24+ new primary-source citations. Heavy fleet usage via sub-agent + websearch.

## [2026-05-04] research | HAMR v3 — 5-axis optimization (#873, EPIC #860)
2226-word v3 research deliverable. Acronym formalized as **HAMR — Harness-Aware Mesh Routing**. Optimizes v2 design across security (SLSA-L3 + OIDC + Cosign Bundle 1.0 + MCP OAuth+DPoP + capability manifests), UX (npx init + magic-link OAuth + progressive disclosure + hamr:status), token-min (per-tier sub-bundles + JSON Patch + LLMLingua-2 distillation + structured outputs; ~80% reduction), paid-token min (Batch APIs 50% off + sticky cache routing + context-editing + header-driven spillover), maintenance (Wrangler 4.x + Tail Workers + R2 lifecycle + schema versioning). 4 new MVP children (SLSA pipeline, per-tier bundle generator, constitution compressor, Batch API). Heavy fleet usage via sub-agent + websearch.
