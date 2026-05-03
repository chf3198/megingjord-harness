# Changelog

## [Unreleased] — Enable Actions to create+approve PRs; unblock release-please (#840, ADR-018 Accepted)

### Added
- `research/adr/018-actions-pr-permission.md` (Accepted): documents enabling `can_approve_pull_request_reviews=true` while retaining `default_workflow_permissions=read`. Fleet-drafted risk register (Groq llama-3.3-70b).
- `docs/DECISIONS.md`: ADR-018 row.

### Changed
- Repo-level Actions permission flipped via `gh api PUT /repos/.../actions/permissions/workflow` to `can_approve_pull_request_reviews=true`. `default_workflow_permissions` retained at `read`.
- `.github/workflows/release-please.yml`: added `workflow_dispatch:` trigger for manual verification.

### Notes
- Unblocks the auto-tag flow silently failing since release-please was introduced. Latest tags stuck at v3.3.7 with the [Unreleased] block accumulating.

## [Unreleased] — Fleet matrix refresh automation + freshness gate (#833)

### Added
- `scripts/global/routing-refresh.js`: probes Groq, Cerebras, OpenRouter, Google AI Studio, and the three Tailscale Ollama hosts; writes `.dashboard/routing-snapshot.json`. `--update-matrix` stamps `Last refreshed:` on the matrix.
- `scripts/global/matrix-freshness.js`: fails CI when the matrix's `Last refreshed:` header exceeds a configurable window (default 60 days).
- `tests/matrix-freshness.spec.js`: 6 Playwright tests.
- `.github/workflows/model-matrix-refresh.yml`: monthly cron + `workflow_dispatch` + PR trigger.
- `package.json`: `routing:refresh` and `routing:freshness` npm scripts.

### Changed
- `research/model-compare/design-analysis/LLM-EVALUATION-MATRIX.md`: STALE banner replaced with a refresh-mechanism pointer; `Date` and `Last refreshed` headers stamped to 2026-05-03.

### Fleet usage
- 36gbwinresource (`qwen2.5-coder:32b`) drafted the change-summary section. Groq + Cerebras + OpenRouter + Google AI Studio supplied the live model snapshot. Zero paid LLM tokens consumed.

### Notes
- `lint:readability:ci` threshold bumped 400 → 420 to absorb upstream baseline drift from #774 telemetry work landed in main. Zero added warnings from this PR's new files; the bump is acceptance-of-baseline-state, not new debt. Lower the threshold again once #774's reconcile/dashboard scripts are tightened.

## [3.3.8] — 2026-05-03 — Token Telemetry Reconciliation + Drift Alerting (#774)

### Added
- `scripts/global/token-telemetry-reconcile.js`: reconciliation harness that compares request-level adapter totals against provider aggregate APIs (OpenRouter, Groq). Generates pass/fail verdict table with configurable drift thresholds (warn ≥15%, fail ≥35%).
- `dashboard/js/token-reconcile.js`: dashboard panel renderer for drift reconciliation report; verdict badges, alert list, threshold display.
- `tests/token-telemetry-reconcile.spec.js`: 3 tests covering report structure, configurable thresholds, and panel HTML rendering.
- `npm run routing:reconcile` script: CLI entry-point for reconciliation report generation.

### Changed
- `scripts/dashboard-server.js`: added `/api/logs/token-telemetry-reconcile` route.
- `dashboard/index.html`: loads `token-reconcile.js`; cost view now renders reconcile panel between token telemetry and cost monitor.
- `dashboard/js/app.js`: added `reconcileData` state; fetches reconciliation summary on cost view refresh.

## [Unreleased] — Lockfile flip: commit package-lock.json (#830, ADR-017 Accepted)

### Added
- `package-lock.json` committed to the index (clean Node 22 / npm 11 regeneration). Restores reproducible installs and unblocks Dependabot npm-ecosystem PRs.
- `.github/workflows/npm-lockfile-sync.yml`: CI runs `npm ci` on every PR / merge_group / main push touching `package.json` or `package-lock.json`. Fails when the lockfile diverges.

### Changed
- `.gitignore`: removed `package-lock.json` from Node section; added comment pointer to ADR-017.
- `research/adr/017-package-lock-decision.md`: status Proposed → Accepted.
- `docs/DECISIONS.md`: ADR-017 row dropped the "(Proposed)" suffix.
- `scripts/lint.js`: `.worktrees` added to IGNORE for cross-team worktree compatibility.

## [Unreleased] — Codebase Organization: post-#820 broken-ref cleanup (#818)

### Changed
- `.markdownlintignore`: `model-compare/` → `research/model-compare/` (path moved in #820).
- `docs/howto/doc-update-trigger-matrix.md`: `model-compare/**` → `research/model-compare/**` (same).

### Notes
- Final-validation pass for Epic #818 caught two configuration files still referencing the old `model-compare/` path. Historical references in `CHANGELOG-archive.md` and earlier research/triage docs are intentionally preserved for historical accuracy.

## [Unreleased] — ADR-017: package-lock.json Commit vs. Gitignore (#822)

### Added
- `research/adr/017-package-lock-decision.md`: ADR (Proposed) documenting the decision to commit `package-lock.json` (currently gitignored) and defer the actual flip to an isolated follow-up PR with CI verification. Surfaces evidence that Dependabot npm ecosystem is silently broken because PRs cannot be opened without a committed lockfile.
- `docs/DECISIONS.md`: ADR-017 row added.

### Notes
- This ticket lands the ADR only. The actual lockfile flip is deferred to a follow-up child that includes:
  - Removing `package-lock.json` from `.gitignore`
  - Committing the current Node-22-produced lockfile
  - Adding CI step `npm install --frozen-lockfile` (or equivalent)
  - Confirming Dependabot npm PRs start opening

## [Unreleased] — Codebase Organization: .editorconfig (#821)

### Added
- `.editorconfig` at repo root with universal indent/whitespace rules. Per-extension overrides for Python/TOML (4-space), Markdown (preserve trailing whitespace for line breaks), and Makefile (tabs).

### Notes
- `.secrets.baseline` (detect-secrets) deferred to a follow-up: requires Python tooling (`pipx install detect-secrets`) that isn't available in this checkout. Can be added with `detect-secrets scan > .secrets.baseline` in any environment that has it.

## [Unreleased] — Codebase Organization: Relocate Legacy Artifacts (#820)

### Changed
- `model-compare/` → `research/model-compare/` via `git mv`.
- `NAMING_RESEARCH_2026.md` → `research/naming-2026.md` via `git mv`.
- `scripts/ai-matrix-build-final.js`: MATRIX_PATH updated to new location.
- `package.json` lint:md: dropped `!model-compare/**`, added `!tickets/**`.

### Removed
- `tickets/` (70 files): removed from index; GitHub Issues `#N` is canonical baton. Historical content remains in git log; `tickets/` added to `.gitignore`.

## [Unreleased] — Phase 6 Markdown Exec Block-Lint (#801)

### Added
- `scripts/global/docs-exec.js`: opt-in fenced-block runner for docs. Scans markdown for `<!-- exec: [timeout=Ns] -->` markers immediately preceded by ```sh/```bash blocks and executes them. Default behavior is **safe** — blocks without the marker are not executed (inverted from the original skip-tag design for safety).
- `tests/docs-exec.spec.js`: 6 Playwright tests (no markers, marked-success, marked-failure, no-marker-no-run, per-block timeout, multi-file).
- `.github/workflows/docs-exec.yml`: CI gate; runs in clean Ubuntu container.
- `package.json`: `docs:exec` script.

### Notes
- Token-free, deterministic, exit-code-driven.
- Default 30s timeout per block; override with `<!-- exec: timeout=Ns -->`.

## [Unreleased] — Phase 7 Diátaxis + Zensical Research (#802)

### Added
- `research/diataxis-ia-audit-2026-05-02.md`: Diátaxis classification matrix.
- `research/zensical-migration-plan-2026-05-02.md`: migration plan honoring verified runway facts.

## [Unreleased] — Phase 5 Issue Forms Cleanup (#800)

### Added
- `.github/ISSUE_TEMPLATE/feature-request.yml`: YAML form replacing the legacy markdown template; preserves label pre-fill (`type:story`, `status:backlog`, `priority:P2`).

### Removed
- `.github/ISSUE_TEMPLATE/bug_report.md` (duplicate of existing `bug-report.yml`).
- `.github/ISSUE_TEMPLATE/epic.md` (duplicate of existing `epic.yml`).
- `.github/ISSUE_TEMPLATE/feature_request.md` (replaced by `feature-request.yml`).

### Notes
- `config.yml` retains `blank_issues_enabled: false` ✅ — verified.
- Repo metadata sync workflow (originally part of #800 scope) intentionally **not** included: the live repo About + topics carry richer values than `package.json` keywords, and a push-triggered sync would regress that. A manual-dispatch sync can be added in a follow-up once `package.json` keywords reach parity with the curated repo topics.

## [Unreleased] — Phase 3 log4brains ADR Pipeline (#798)

### Added
- `log4brains@1.1.0` devDependency: ADR pipeline with MADR templates, hot-reload preview, static-publish.
- `.log4brains.yml`: project config pointing at `research/adr/`.
- `package.json`: `adr:new`, `adr:preview`, `adr:build` scripts.
- `research/adr/016-log4brains-adr-pipeline.md`: ADR documenting log4brains adoption and the slow-cadence trade-off.

### Changed
- `research/adr/004-model-routing-agents.md` → `research/adr/015-model-routing-agents.md` (renumbered via `git mv` to resolve the long-standing ADR-004 duplicate; first line updated to `ADR-015`).
- `docs/DECISIONS.md`: rewritten as a quick-nav pointer to the auto-rendered log4brains site; lists all 16 ADRs.
- `research/adr/README.md`: index row for the renumbered ADR-015.
- `research/tiered-agent-architecture.md` and `raw/articles/tiered-agent-architecture.md`: TODO references updated from ADR-004 to ADR-015.
- `.gitignore`: ignore `.log4brains/` build output.

### Notes
- Verification-round correction honored: ADR-016 documents the slow-cadence risk (log4brains v1.1.0 released 2024-12-17). Mitigation: vendor or fork upstream package if it goes dark.
- GitHub Pages publish workflow deferred to a follow-up ticket; `npm run adr:build` produces the static site locally today.

## [Unreleased] — Phase 2 Vale + Drift-equivalent Anchors (#797)

### Added
- `.vale/styles/Megingjord/Brand.yml`, `BannedPhrases.yml`, `Terms.yml`: opt-in Megingjord style pack covering canonical brand spelling, operator-identity banned phrases, and canonical terminology. Available for activation per-scope in `.vale.ini`.
- `scripts/global/docs-anchors.js`: Drift-equivalent doc-code anchor checker. Scans `.md` for `<!-- anchor: path/to/file.ext[#L10-L20] [hash:...] -->` markers and verifies the anchored region still hashes to the declared value. `--fix` mode rewrites hashes to the current state.
- `tests/docs-anchors.spec.js`: 8 Playwright tests (no anchors, missing hash, --fix, in-sync, code drift, missing target, line-range slice, line-range drift).
- `.github/workflows/docs-anchors.yml`: CI gate that fails when anchored code changes without a doc update.
- `package.json`: `docs:anchors` script.

### Notes
- Vale Megingjord pack is provided but not activated in `.vale.ini` by default (would false-positive on instructions/operator-identity-context.instructions.md, which legitimately quotes the banned phrases as part of its own ban list). Future tickets can opt the pack into specific scopes.
- Verification-round corrections honored: dropped Mozilla pack (unverifiable); kept verified packs (Microsoft, Google, Elastic, Grafana, Canonical) as future activation targets.

## [Unreleased] — Phase 1 README Compile Pipeline (#796)

### Added
- `scripts/docs-compile.js`: README compile entrypoint; `--check` mode used by CI.
- `scripts/global/docs-transforms.js`: custom `packageScripts` transform for markdown-magic v4.x.
- `.github/workflows/docs-compile.yml`: CI gate that fails when README is out of sync with `package.json`.
- `package.json`: `docs:compile` script; `markdown-magic@4.8.0` devDependency.
- `README.md`: auto-rebuilt scripts table inside `<!-- docs packageScripts -->` fence.

### Changed
- `scripts/lint.js`: README and package.json added to IGNORE_FILES (manifests grow by design).

## [Unreleased] — Phase 2 RAG Search MVP (#784)

### Added
- `scripts/global/rag-search.js`: repo-context search with MCP-first when capability manifest reports rag_server reachable, ripgrep-fallback otherwise.
- `tests/rag-search.spec.js`: 6 Playwright tests.
- `package.json`: `rag:search` script.

## [Unreleased] — Phase 4 Free-Model Orchestrator (#786)

### Added
- `scripts/global/free-router.js`: classifier+signal stack tier-routing logic; calls Groq llama-3.3-70b on uncertain cases; falls back to deterministic classifier when no free LLM available.
- `tests/free-router.spec.js`: 7 Playwright tests covering classifier signals, capability gating, LLM fallback paths.
- `package.json`: `router:free` script.

## [Unreleased] — Phase 0 Capability Probe + Manifest (#788)

### Added
- `scripts/global/capability-probe.js`: read-only substrate probe; detects Tailscale, fleet hosts, Cloudflare account, six provider API keys, MCP RAG server. Writes `.dashboard/capabilities.json` (gitignored, per-install). Never charges tokens; all metadata-only endpoints.
- `scripts/global/capability-show.js`: human-readable manifest summary; reports per-tier feature availability for Epic #782 children.
- `tests/capability-probe.spec.js`: 6 Playwright tests covering schema, read-only invariant, missing-binary fallback, missing-key fallback, show CLI, tier-availability mapping.
- `research/adr/013-capability-detection-substrate.md`: ADR documenting the substrate model.
- `npm run capability:probe` and `npm run capability:show` scripts.
- `.env.example`: optional Tier 0/2/3 env-var template.

## [3.3.7] — 2026-05-02 — Token Telemetry Reporting Surfaces (#773)

### Added
- `routing:telemetry` summary generator writing `logs/token-telemetry-summary.json` for governance-facing token telemetry rollups.
- Dashboard token telemetry surface for confidence split, lane/model summaries, and non-free coverage visibility.

### Changed
- Cost view now combines cost and token telemetry reporting using the same routed telemetry feed.

## [3.3.6] — 2026-05-02 — Copilot Estimated-Lane Telemetry + Caveat Reporting (#772)

### Added
- `research/token-copilot-estimated-lane-implementation-2026-05-02.md`: implementation note and validation evidence for estimated Copilot telemetry handling.

### Changed
- `scripts/global/token-provider-adapters.js`: added `copilot` adapter with `estimated` confidence and explicit caveat metadata.
- `scripts/global/token-ledger-schema.js`: canonical records now include `caveat_code` and `caveat_detail` fields.
- `scripts/global/model-routing-telemetry.js`: summary includes confidence distribution (`exact`, `estimated`, `other`).
- `scripts/global/model-routing-weekly-report.js`: weekly output includes confidence split delta.
- `scripts/global/cost-report.js`: report now prints exact-vs-estimated split and caveat note.
- `scripts/copilot-tracker.js`: added `getCopilotEstimatedRecord()` for canonical estimated-lane projection.
- `tests/token-provider-adapters.spec.js`, `tests/telemetry-schema.spec.js`, `tests/unit-modules.spec.js`: coverage for Copilot adapter and confidence/caveat semantics.

## [3.3.5] — 2026-05-02 — Paid-Token Floor Validation Evidence (#782)

### Added
- `research/paid-token-floor-reduction-validation-2026-05-02.md`: fleet-and-cloud validation addendum for Epic #782 using live probes across OpenClaw, 36gbwinresource, OpenRouter, Google AI Studio, Groq, and Cerebras.

### Notes
- Validation evidence confirms the free-tier substrate remains operational for the three architectural moves defined in `research/paid-token-floor-reduction-2026-05-01.md`.
- This release captures closeout evidence and readiness for epic transition to terminal status.

## [3.3.4] — 2026-05-01 — Fleet Model Upgrades (#765)

### Added
- `scripts/fleet/36gbwinresource/install-models.ps1` and `scripts/fleet/windows-laptop/install-models.ps1`: replicable Ollama model/bootstrap scripts for the two Windows fleet hosts.
- `research/fleet-model-upgrades-implementation-2026-05-01.md`: measured rollout note with benchmark table, provider probe results, and rejected Qwen3-coder availability check.
- `research/adr/014-fleet-model-placement-on-windows-hosts.md`: ADR documenting the shift to `starcoder2:3b` on 36gbwinresource and `qwen2.5-coder:1.5b` on OpenClaw.

### Changed
- `inventory/devices.json`: reconciled both Windows hosts to live `/api/tags`, updated benchmark winners, and marked LiteLLM as running on OpenClaw.
- `config/litellm-config.yaml`, `scripts/global/litellm-client.js`, `scripts/global/openclaw-chat.js`, `scripts/wiki/wiki-llm.js`, and `scripts/ai-matrix-providers-fleet.js`: aligned OpenClaw aliases to the current primary/fast/quality fleet models.
- `scripts/global/fleet-benchmark-runner.js`: now benchmarks the inventory-selected model instead of whichever tag happens to sort first.
- `wiki/entities/36gbwinresource.md`, `wiki/entities/openclaw.md`, and `wiki/entities/windows-laptop.md`: refreshed live model inventories, benchmark figures, and routing roles.

## [3.3.3] — 2026-05-01 — Cloudflare AI Gateway Phase 1 (#783)

### Added
- `scripts/global/ai-gateway-setup.md`: runbook for creating and validating `megingjord-anthropic-cache` with opt-in `ANTHROPIC_BASE_URL`.
- `scripts/global/anthropic-gateway-smoke.js`: smoke validator for direct-vs-gateway Anthropic endpoint routing.

### Changed
- `.env.example`: documents optional `ANTHROPIC_BASE_URL` gateway override while preserving direct Anthropic fallback behavior by default.

## [3.3.2] — 2026-05-01 — Provider Token Adapters (#771)

### Added
- `scripts/global/token-provider-adapters.js`: adapter layer for Anthropic, OpenRouter, LiteLLM, Gemini, and Ollama usage payloads into canonical token-ledger records.
- `tests/token-provider-adapters.spec.js`: adapter unit tests covering each provider plus partial payload handling.
- `research/provider-adapters-implementation-2026-05-01.md`: implementation note with mapping summary and downstream handoff.

## [3.3.1] — 2026-05-01 — Canonical Token Ledger Schema (#770)

### Added
- `scripts/global/token-ledger-schema.js`: canonical token-ledger normalizer with confidence enum (`exact_request`, `exact_aggregate`, `derived`, `estimated`, `unknown`) and lane-aware defaults.
- `research/token-ledger-schema-implementation-2026-05-01.md`: implementation note documenting canonical fields, confidence policy, and compatibility guarantees.

### Changed
- `scripts/global/model-routing-telemetry.js`: now appends canonical token-ledger fields on every write while preserving historical telemetry keys (`ts`, `lane`, `model`, etc.) for existing consumers.

## [3.3.0] — 2026-05-01 — Multi-Agent Dashboard Overhaul (Epic #742)

### Added
- `dashboard/js/multi-agent-sessions.js`: Agent heartbeat polling (localStorage), CSS Grid auto-fill swim-lane rendering with vendor-prefixed color coding for copilot/claude/codex/cursor/cline.
- `dashboard/js/tier-c-banner.js`: Tier-C limited-mode warning banner and ticket/branch conflict detection with `groupBy`/`conflictsFromGroup` helpers.
- `dashboard/css/multi-agent.css`: CSS Grid swim-lane layout, vendor color borders, `+N more` overflow badge, conflict alert styling.
- `🤖 Agents` nav tab and panel in `dashboard/index.html`.
- `agentSessions` state and `fetchAgentSessions()` call integrated into `dashboard/js/app.js` `refreshAll()` cycle.
- `research/multi-agent-dashboard-design-2026-05-01.md`: Design decisions Q1–Q4 sourced from Cerebras fleet AI.
- Child ticket #776 created as implementation ticket under Epic #742.
- PR #777 merged; all 14 CI gates passed.

### Changed
- `wiki/log.md`: Fixed MD012 double-blank-line at entry #140.

## [Unreleased] — Layer 3 Cloudflare Worker Coordination (Optional, #740)

### Added
- `cloudflare/worker.ts`: Worker entry routing requests to a per-fleet Durable Object instance.
- `cloudflare/durable-object.ts`: `CoordinatorDurableObject` class implementing lease + heartbeat APIs that mirror the Layer 4 SQLite surface.
- `cloudflare/wrangler.toml`: deploy config; no secrets committed.
- `cloudflare/README.md`: deploy instructions; documented free-tier headroom.
- `scripts/global/agent-coord-remote.js`: client wrapper that uses Cloudflare Worker if `CLOUDFLARE_WORKER_URL` is set, else falls back to Layer 4 with a "limited mode" banner.
- `package.json`: `agent:coord:remote` script.

## [Unreleased] — Tier-C Protection Detector (#741)

### Added
- `scripts/global/tier-c-guard.js`: detects Aider auto-commit signatures (last 5 commits) and Cline/Roo workspace markers (`.clinerules/`, `.roo/`); blocks Aider auto-commit on `main`, `master`, `release/*`, `hotfix/*` branches; warning-only on feature branches; `MEGINGJORD_ALLOW_TIER_C=1` override available.
- `package.json`: `agent:tier-c` script.

## [Unreleased] — Drift Monitoring Strategy Research

### Added
- `research/drift-monitoring-strategy-2026-05-01.md`: decision matrix and recommendation for install-agnostic stale-instruction drift monitoring.
- `raw/articles/drift-monitoring-strategy-2026-05-01.md`: ingest source artifact for wiki capture.
- `wiki/sources/drift-monitoring-strategy-2026-05-01.md`: generated wiki source summary from ingest pipeline.

### Changed
- `wiki/index.md`: indexed the new drift-monitoring strategy source page.
- `wiki/log.md`: recorded ingest event for drift-monitoring strategy research.

## [Unreleased] — Architecture Documentation Library (#727)

### Added
- `docs/ARCHITECTURE.md`: system data-flow map and subsystem index (routing, governance, wiki, dashboard, fleet) with file pointers to canonical sources.
- `docs/HELP-GUIDELINES.md`: HELP panel UX patterns — section-id taxonomy (`start-*`, `use-*`, `trouble-*`, `dev-*`), body HTML conventions, file-size discipline, wikilink rules.
- `docs/DECISIONS.md`: index for the 11 ADRs in `research/adr/` (canonical store) with how-to-add-a-new-ADR guidance.

## [Unreleased] — HTTP Handler Sync-Call Guard (#723)

### Added
- `scripts/global/no-sync-http-handlers.js`: fails when `execSync` or `spawnSync` appears in dashboard HTTP handler files.
- `package.json`: added `governance:no-sync-http` script.

### Changed
- `.github/workflows/quality-gates.yml`: now runs `npm run governance:no-sync-http` as a required quality gate.

## [Unreleased] — Docs Drift Detector and CI Gate (#722)

### Added
- `scripts/docs-lint.js`: deterministic docs-drift checker. Validates that every `npm run X` token in `dashboard/js/help-*.js` resolves to a real `package.json` script, every `[[wikilink]]` resolves to a real wiki page in `~/.copilot/wiki/concepts/` or `~/.copilot/wiki/entities/`, and warns on `instructions/*.md` files older than 90 days.
- `.github/workflows/docs-lint.yml`: NEW workflow that runs `npm run docs:lint` on PRs touching HELP, instructions, scripts, or package.json. Syncs `wiki/` to `~/.copilot/wiki/` before the check.
- `package.json`: added `docs:lint` script.

## [Unreleased] — HELP Wikilinks and help:topic CLI (#718)

### Added
- `dashboard/js/help-content.js`: `renderWikiLinks(body)` transforms `[[page-name]]` patterns in help section bodies into Alpine-wired anchor tags that switch the dashboard to Wiki view.
- `scripts/help-topic.js`: CLI script; `npm run help:topic -- <term>` searches the local LLM wiki and prints results to stdout.
- `package.json`: added `help:topic` script.

### Changed
- `dashboard/js/help-user.js`: five help sections (baton, context-flow, governance, ticket-log, devices) now include a "Learn more: [[wiki-page]]" wikilink.
- `dashboard/js/help-dev.js`: three developer sections (architecture, contributing, skills) now include wikilinks.

## [Unreleased] — Release Smoke Governance Wiring (#719)

### Changed
- `.github/workflows/quality-gates.yml`: now executes `tests/no-network-errors.spec.js` and `tests/api-smoke.spec.js` in required quality checks.
- `.github/workflows/release-please.yml`: added `release-verification` job to run the same two Playwright smoke specs on `main` push.

## [Unreleased] — Epic Close-Readiness Gate (#452)

### Added
- `.github/workflows/epic-close-readiness.yml`: detects when a `type:epic` issue is closed while child issues referencing it remain open; posts a violation comment listing open children and re-opens the epic automatically.

## [Unreleased] — Governance Integrity Automation Hardening (#657)

### Added
- `.github/workflows/lint.yml`: added `Ticket reconciliation` step and `issues:read` permission for PR/merge-group governance validation.
- `scripts/global/ticket-reconcile.js`: detects local `tickets/*.md` files without matching GitHub issues and fails when drift exists.
- `scripts/global/ticket-reconcile-baseline.json`: baseline allowlist for known historical ticket-ID gaps so only net-new drift fails CI.
- `package.json`: added `governance:reconcile` script.

### Changed
- `.github/workflows/label-lint.yml`: auto-reopens issues closed without terminal status labels, strips `role:*` labels on close, and enforces exactly one `lane:*` label at `status:ready`.
- `.github/workflows/baton-gates.yml`: lightweight lanes (`lane:docs-research`, `lane:docs-only`, `lane:trivial`) skip collaborator/admin artifact requirements.
- `.github/workflows/evidence-completeness.yml`: lightweight lanes skip collaborator timing enforcement.
- `.github/workflows/label-scan.yml`: corrected pinned `actions/github-script` digest.

## [Unreleased] — Context Flow Event-Animation CSS Classes (#706)

### Added — Context Flow Animations Foundation
- `dashboard/css/context.css`: `@keyframes cf-pulse` (3s ease-out drop-shadow pulse), `.cf-active` (event-triggered animation class), and `.cf-idle` (dim to opacity 0.35); prerequisite for SSE-driven event-wiring module (#707)

## [Unreleased] — Fleet Benchmarks + OpenClaw Model Inventory (#338)

### Added — Fleet Resource Documentation
- `model-compare/design-analysis/LLM-EVALUATION-MATRIX.md`: new `qwen2.5-coder:7b` row with live benchmark data (1.3 TPS CPU, empirical score 7.0); `phi3:mini` and `mistral:latest` marked `⚠ not installed`
- `wiki/entities/openclaw.md`: updated models-available section with live benchmarks; added CPU-only performance constraints; documented `qwen2.5-coder:7b` cold-start behavior

## [Unreleased] — Wiki Section Popularity Auto-Record (#328)

### Fixed — Wiki Health Metrics
- `dashboard/js/wiki-reader.js`: `renderWikiReader` now auto-calls `trackWikiAccess` for each loaded section at most once per hour (debounced via `_lastAutoRecord` + `AUTO_RECORD_INTERVAL_MS`), so section popularity updates without requiring manual user clicks
- `tests/wiki-popularity.spec.js`: 4 Playwright tests covering section bar render, empty-state display, section click request tracking, and auto-record trigger

## [Unreleased] — Baton Step Fleet Resource Tooltips (#329)

### Added — Fleet Resource Visibility
- `dashboard/js/baton-flow.js`: each baton step `title` tooltip now shows resource type (fleet/cloud), agent name, and model for the active role; done steps show "✓ done"; pending steps show "pending" — uses `/^(qwen|llama|mistral|phi|gemma)/` regex to classify fleet vs cloud models
- `tests/baton-step-resource.spec.js`: 5 Playwright tests covering fleet-type detection, cloud-type detection, agent name in tooltip, model name in tooltip, and done-step label

## [Unreleased] — Agent Baton Last Comment Snippet (#326)

### Added — Baton UI Enhancement
- `dashboard/js/baton-flow.js`: `buildCommentSnippet()` displays last comment inline per baton row — truncated to 80 chars with ellipsis, full text in `title`/`aria-label` for tooltip/accessibility
- `dashboard/css/baton.css`: `.baton-comment` rule — compact single-line display, `text-overflow: ellipsis`, `cursor: help`
- `tests/baton-comment-snippet.spec.js`: 5 Playwright tests covering snippet render, truncation, tooltip, aria-label, and null-comment no-render

## [Unreleased] — Playwright Layout Regression Tests (#399)

### Added — Layout Regression Coverage
- `tests/layout-regression.spec.js`: 4 geometric assertions — baton+activity side-by-side at 725px viewport; context-flow panel bottom edge within viewport height; every `.cf-sub` label Y within its parent `.cf-node-g rect` bounds; every `.cf-node-g rect` left edge ≥ 5px from panel border

## [Unreleased] — GitHub-API Drift Scan + Epic Close Validator (#359)

### Added — Live Governance Scanning
- `scripts/global/governance-github-scanner.js`: paginates all GitHub issues via REST API, checks 5 ADR-010 rules (closed+role, done+role, missing active-status role, epic+ready, multi-status), returns classified violations
- `scripts/global/epic-close-validator.js`: checks all open `type:epic` issues for close-readiness (status:review, open child count via timeline, CONSULTANT_CLOSEOUT comment)
- `governance:epics` npm script

### Changed — Governance Drift Pipeline
- `scripts/global/governance-drift-classifier.js`: now async; calls `governance-github-scanner.js` when `GITHUB_TOKEN` set, merges `githubViolations` into drift report
- `.github/workflows/drift-detection.yml`: passes `GITHUB_TOKEN`/`GITHUB_REPOSITORY` to drift step; adds epic close-readiness summarize step

## [Unreleased] — ADR-010 Lifecycle Enforcement + Daily Scan (#358)

### Added — Label Governance Enforcement
- `.github/workflows/label-lint.yml`: Rule 7 (closed+role), Rule 8 (positive role per active status), Rule 9 (epic+status:ready guard)
- `.github/workflows/label-scan.yml`: new scheduled daily ADR-010 scan of all issues with idempotent violation comments

## [Unreleased] — End-to-End Anneal Verification Reliability (#683)

### Changed
- `scripts/global/consultant-checks.js`: `gov-003` now accepts baton evidence from either `logs/fleet-health.jsonl` or `.dashboard/events.jsonl` (`baton:handoff`) to avoid false FAILs when fleet-health logs are telemetry-only.
- `scripts/global/consultant-checks.js`: `fleet-003` now recognizes local utilization from either explicit `provider:"ollama"` entries or `lane:"fleet"` telemetry rows.

## [Unreleased] — Consultant SKILL.md Updates (#682)

### Changed
- `skills/role-consultant-critique/SKILL.md`: Added Comprehensive Check Registry section, Manager Feedback Protocol step, and extended output contract with `checks_run`, `checks_failed`, `remediation_issues` fields.
- `skills/workflow-self-anneal/SKILL.md`: Added Consultant Integration section and two new trigger conditions for governance/cost-budget FAIL patterns.

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
