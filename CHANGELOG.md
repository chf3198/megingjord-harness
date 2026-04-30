# Changelog

## [Unreleased] — Consultant Feedback Bridge (#681)

### Added
- `scripts/global/consultant-feedback.js`: Manager backlog feedback bridge. Converts failed `consultant-checks.js` results into GitHub create-or-augment backlog actions and posts a Remediation Brief on the originating issue. Closes Epic #610 child #614.

## [3.2.0] — Rebrand: DevEnv Ops → Megingjord (2026-04-29)

### Changed — Global Rebrand
- Package name: `devenv-ops` → `megingjord-harness`
- Repository title: "devenv-ops" → "Megingjord"
- Core documentation and plugin metadata updated to Megingjord branding
- Added `NAMING_RESEARCH_2026.md` with naming research and recommendation

### Why Rebrand?
Megingjord better positions the harness as a **governance-first** AI agent orchestration tool. Research into current naming patterns identified Megingjord as:
- **Distinctive + memorable** (vs. generic "DevOps" nomenclature)
- **Governance-aligned semantics** (protection, guardrails, policy)
- **Lower naming-conflict risk** after rejecting "Codex" due OpenAI brand collision and "Aegis" due broad prior use

## [Unreleased] — Request Queuing + Exponential Backoff (#670)

### Added — Rate-Limit Resilience
- `scripts/global/backoff.js`: `backoff(attempt, opts)` — exponential delay with 20% jitter, capped at 60s; `isRateLimitError(err)` — matches HTTP 429/503 and message patterns
- `scripts/global/request-queue.js`: `RequestQueue` with priority lanes (urgent/normal/low), RPS throttle, adaptive backpressure (RPS drops on task failure), max queue 500, `getStats()`, `drain()`
- `scripts/global/cascade-dispatch.js`: `tryOllama` now retries up to 3 times on rate-limit errors using `backoff.js`; graceful escalation after max retries

## [Unreleased] — Fleet Quantization Strategy + Device Inventory (#669)

### Changed — Fleet Device Inventory
- `inventory/devices.json`: added `recommendedModels[]` with `quantization`, `paramSize`, `sizeGB`, `use` per model for all 3 Ollama fleet nodes (penguin-1, windows-laptop, 36gbwinresource)
- `inventory/devices.json`: added `benchmarks` object per device with `platform`, `warmTokPerSec`, `model`, `quantization`, `notes`; 36gbwinresource at 32.3 tok/s GPU, windows-laptop at 7.3 tok/s CPU
- All 3 nodes confirmed reachable via Tailscale; live quantization: Q8_0 (sub-2b), Q4_K_M (7b)

## [Unreleased] — Real-Time Cost Monitor Dashboard (#672)

### Added — Cost Dashboard
- `dashboard/js/cost-monitor.js`: browser module with `fetchCostTelemetry()` and `renderCostMonitor(data)`; projected monthly cost, budget bar (80% alert), tier distribution table, last 5 requests
- `dashboard/index.html`: added `💰 Cost` nav button and cost-monitor panel template
- `dashboard/js/app.js`: wired `costData` into Alpine data object; populated in `refreshAll()`
- `scripts/dashboard-server.js`: `/api/logs/cost-telemetry` endpoint serving `logs/cost-telemetry.jsonl`; 404 when absent

## [Unreleased] — Cost Telemetry + Routing Discipline (#668)

### Added — Cost Accounting per Dispatch
- `scripts/global/cost-telemetry.js`: per-dispatch cost logger writing `logs/cost-telemetry.jsonl`; computes `cost_usd` per tier at 2026 blended pricing; budget alert at 80% of $10/mo
- `scripts/global/task-router-dispatch.js`: now calls `recordCostEvent()` on every fleet dispatch
- `npm run cost:baseline`: runs cost-telemetry summarizer for 30-day window
- `scripts/lint.js`: added `.claude` to IGNORE list (excludes agent worktrees from 100-line scan)

## [Unreleased] — Verification Baseline + Cost Measurement (#671)

### Added — Cost Baseline Tooling
- `scripts/global/cost-baseline.js`: before/after comparison tool; reads `logs/cost-telemetry.jsonl`, shows current projected monthly cost vs pre-optimization baseline ($60.38/mo, ~1090 req, 100% premium); outputs savings delta
- `npm run cost:baseline`: runs cost-baseline.js for 30-day window comparison

## [Unreleased] — Instruction Token Footprint Reduction (#667)

### Changed — Instruction Optimization
- 15 instruction files reduced by 877 words (15.0%) with no governance regression
- `role-baton-routing`: dropped Sequence section (duplicated transition guards) and De-duplication boundary
- `ticket-driven-work`: removed Linking Rules section and condensed work-type matrix to prose
- `release-docs-hygiene`: removed intro bullets that duplicated post-merge checklist
- `workflow-resilience`: removed Documentation drift rules section (covered by release-docs-hygiene)
- `github-governance`: removed five "invoke skill" pointer lines, condensed capability-first section
- All 363 files ≤100 lines; readability baseline maintained at 389 warnings

## [Unreleased] — CI Workflow Efficiency Improvements (#661)

### Changed — Scheduled Workflow Reliability

## [Unreleased] — Consultant Check Registry Bootstrap (#664)

### Added — Initial Registry CLI
- `scripts/global/consultant-checks.js`: new lightweight CLI emitting governance/tools/fleet check records with `id`, `domain`, `status`, `evidence`, `finding`, and `suggestedFix`
- Supports `--issue`, `--json`, and `--dry-run` for machine-parseable baton usage and low-cost local validation

### Fixed — Governance Baseline Metadata
- `tickets/599-task-sandbox-worktree-governance-pack.md`: normalized plain metadata headers (`Type`, `Status`, `Priority`, `Area`) to satisfy verifier parsing on current mainline baseline

## [Unreleased] — Governance Verifier Hygiene (#652)

### Fixed — Governance Verifier False Positives
- `scripts/global/governance-verify.js`: removed `Signed-by:` requirement from local ticket files; baton record lives in GitHub comments (enforced by baton-gate CI). Eliminated 53 false-positive drift findings covering 98% of all tickets
- Bulk label cleanup: stripped lingering `role:*` labels from 9 closed issues and corrected `status:*` labels on 26 closed issues (no-status, wrong-status, backlog/review on closed state)

## [Unreleased] — Wiki Critical Audit and Structural Repair (#651)

### Fixed — LLM Wiki Health
- `scripts/wiki/lint.js`: orphan detection now counts `index.md` references as inbound links (index was excluded from link graph, causing false orphan reports for all indexed pages)
- Repaired frontmatter on 9 wiki pages (plural type fields corrected, missing `created`/`status` added)
- Fixed `concepts/github-integration.md`: `category:` → `type:`, added `related` field
- Removed 3 ghost index entries (`linting-governance-rationale/tooling/rollout` — files don't exist)
- Fixed 2 broken wikilinks in code-block documentation examples

### Added — LLM Wiki Improvements
- `wiki/WIKI.md`: schema reference with `confidence`, `last_verified`, `sources_count`, `superseded_by` frontmatter fields; lint rule for >90-day staleness
- `wiki/syntheses/llm-wiki-state-2026.md`: synthesis from 16 web sources; validates flat-markdown at 65-page scale; 5 actionable improvements
- `wiki_router.py`: `infra-automation` routing branch injecting fleet routing order and governance enforcement layers for devenv-ops sessions; max snippets raised to 5
- Index rebuilt: 65 pages, clean section structure, 8 missing source entries added
- Log updated with 7 entries for #647, #360, #595, #651

## [Unreleased] — Continuous Governance Drift Detection (#360)

### Added — Governance Drift Classification
- `scripts/global/governance-drift-classifier.js`: classifies governance issues into `open`, `terminal`, and `epic` drift classes; exits 1 on drift detected
- `tests/governance-drift.spec.js`: 11 targeted unit tests for all drift classification paths
- `.github/workflows/drift-detection.yml`: daily + manual CI workflow writing `logs/governance-drift.json`
- npm script `governance:drift` for manual drift runs
- Extended `scripts/global/governance-weekly-report.js` with `driftByClass` metrics and robust verifier error handling

## [Unreleased] — Sandbox Launcher Sync (#647)

### Added — Worktree Governance Automation
- `.github/workflows/post-merge-sandbox-sync.yml`: fires on push to `main`; force-resets `sandbox/copilot`, `sandbox/codex`, `sandbox/claude-code` to the new main SHA via the GitHub REST API — closes the gap where `worktree-governance-required` enforced currency but no automation maintained it

## [Unreleased] — HELP Docs and Doc Governance (Epic #335)

### Added — HELP Documentation Infrastructure (#522 #639 #640 #641 #644)
- `docs/howto/help-inventory.md`: full audit of all 36 skills; zero HELP.md coverage; priority gap table
- `docs/howto/doc-update-trigger-matrix.md`: maps code-area patterns to required doc surfaces; CI gate spec
- `docs/howto/baton-workflow.md`: end-to-end developer HOWTO for the Agile baton ticket lifecycle
- `docs/howto/fleet-routing.md`: developer HOWTO for fleet routing lanes, complexity scoring, and cost-report
- `.github/workflows/doc-update-gate.yml`: CI gate — fails PRs that modify skills/instructions/scripts without a doc update
- `scripts/lint.js`: added `docs/howto` to 100-line exclusion list (same pattern as `instructions/` and `research/`)

## [Unreleased] — Self-Anneal Governance Infrastructure (Epic #416)

### Added — Fleet Capability Tagging (Epic #561)
- `inventory/devices.json`: added `routing` capability tags for all devices and registered `36gbwinresource` as `performance`/`heavy-coding` primary fleet node
- `research/fleet-capability-tagging-research.md`: capability-tag survey and internal wiki gap analysis
- `research/adr-fleet-capability-tags.md`: accepted schema contract for router-readable fleet metadata
- `wiki/entities/36gbwinresource.md`: new fleet entity profile

### Changed — Router Fleet Targeting (Epic #561)
- `scripts/global/task-router.js`: fleet lane now selects `targetDevice` and `targetOllamaUrl` from inventory capability tags
- `scripts/global/task-router-policy.json`: capability-tag selection metadata added
- `scripts/global/model-routing-policy.json`: judge gate enabled after GPU fleet node confirmation
- `scripts/global/ollama-direct.js`: default direct endpoint moved to `36gbwinresource`
- `wiki/concepts/model-routing.md`, `wiki/sources/devenv-fleet-topology.md`: updated topology and routing order

### Added — Atomic Label Transitions (#417)
- `scripts/global/issue-transition.js`: single `gh issue edit` call validates and executes baton transitions, eliminating ADR-010 label-lint race conditions
- `npm run issue:transition` script

### Added — DangerJS PR Governance (#418)
- `Dangerfile.js`: enforces ticket-first (`Closes #N`), branch naming, Conventional Commits, and `#N` title suffix on all PRs
- `.github/workflows/danger.yml`: `danger-required` CI check gates all PRs to main

### Added — PR Title Enforcement (#419)
- `.github/workflows/pr-title.yml`: `pr-title-required` CI check via `amannn/action-semantic-pull-request@v5`; enforces type, scope, and ≤60-char subject

### Added — PreToolUse Commit Hook (#420)
- `hooks/scripts/baton_gate.py`: blocks `git commit` without `#N` issue reference in message; hints branch number
- `.claude/settings.json.template`: documents required Claude Code hook registration

### Added — Governance Document Linting (#421)
- `.vale.ini` + `.vale/styles/Governance/TicketFields.yml`: enforces `Priority:`, `Type:`, `Status:` fields in tickets and instructions at error level
- `.markdownlint.json` + `.markdownlintignore`: markdownlint CI with zero-error baseline
- `lint:md` npm script; CI `lint-required` job extended

### Added — release-please Automation (#422)
- `.github/workflows/release-please.yml`: auto-generates release PRs with CHANGELOG diffs on every push to main
- `.release-please-config.json`: node release-type; bumps `package.json` + `plugin.json`
- `.release-please-manifest.json`: baseline `3.1.0`

### Added — Baton Gate Chain (#423)
- GitHub Environments: `collaborator-gate`, `admin-gate`, `consultant-gate` with Required Reviewer
- `.github/workflows/baton-gates.yml`: chained environment jobs; each gate pauses for explicit operator approval
- `CONTRIBUTING.md`: Baton Gate Chain section documenting gate semantics

## [3.1.0] - 2026-04-24

### Added — Model Routing Telemetry (#411)
- `model-routing-engine.js`: policy-driven routing; classifies tasks, applies rollback logic
- `model-routing-telemetry.js`: records per-dispatch events to `~/.copilot/logs/`
- `model-routing-policy.json`: task-class → model-id + multiplier policy
- `npm run router:weekly`: weekly cost/quality scorecard from telemetry log
- `fleet-live-indicator.js`: real-time CLI system status (Ollama, memory, OpenClaw)

### Added — Governance Verifier (#412)
- `governance-verify.js`: scans `tickets/*.md` for ADR-010 violations; `--json` output

### Changed — Governance Instructions (#409)
- `ticket-driven-work.instructions.md`: GitHub evidence block, Ready-SLA contract, exception schema
- `epic-governance.instructions.md`: re-scope-before-close rule
- `workflow-resilience.instructions.md`: ready-stall blocker note minimum fields
- CI workflows: `merge_group` trigger, stable job names, path filters, concurrency groups

### Fixed — Dashboard JS ESLint Compliance (#410)
- Added `/* global */` directives to 15 dashboard JS modules
- Exported public APIs via `Object.assign(window, {})` in provider modules
- Null-safety: strict equality guards in `render-panels.js`

## [3.0.2] - 2026-04-23

### Fixed — Agent Baton Filtering (#122)
- Baton panel displays only `in-progress` or `review` tickets
- GitHub issues without `status:*` label default to `backlog`
- Prevents 300+ untagged issues from flooding baton view

### Fixed — Context Flow Animation (#123)
- Context Flow SVG renders with all topology nodes and arrows
- Data packet animations display when active baton exists
- Fixed `isActive` parameter passing to arrow renderer

### Added — JSDoc Documentation
- `dashboardApp()`, `cfArrows()`, `syncWithGitHub()` documented
- Baton filter and Context Flow animation logic documented

## [3.0.1] - 2026-04-14

### Added — Wiki Self-Annealing (#96)
- `scripts/wiki/anneal.js`: auto-fix broken links, orphans, frontmatter
- `npm run wiki:anneal` (dry-run default, `--apply` to write)

### Added — SSE Push Model (#97)
- `/api/events/stream` SSE endpoint
- Event bus client with polling fallback

## [2.4.1] - 2025-07-14

### Fixed — Dashboard UX Polish (11 issues from v2.4.0 UAT)
- Header status, Tailscale count, Fleet topology, Help toggle
- Refresh slider, Activity log, Quotas, Router Lanes, Router Log
- Wiki panel, Stress test refinements

## [2.4.0] - 2026-04-14

### Added — Live Event System (#35)
- Event emitter and reader with JSONL persistence
- Event bus client with `/api/events` polling
- Agent names and activity tracking in baton panel

**See [CHANGELOG-archive.md](CHANGELOG-archive.md) for versions 2.3.0 and earlier.**
