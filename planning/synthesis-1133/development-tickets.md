# Epic #1133 Development Tickets — Copilot Team Recommendations

## Derived from Phase-R Findings

Based on R&D findings, here are the recommended development tickets for Epic #1133, organized by milestone and team coverage:

---

## Milestone A: Core Sensor & Pattern Catalog (Copilot Team)

### Ticket D-1133-01: `workflow-anneal-detect.js` Pattern Scanner

**Title**: Implement recurring pattern detection engine for CI/workflow failures

**Type**: Task | **Story Points**: 8 | **Epic**: #1133

**Description**:
Develop core detection script that:
1. Fetches GitHub Actions runs + merged PRs for last 7 days via REST API
2. Scans logs for failure signatures matching patterns in `recurring-patterns.json`
3. Computes recurrence count in rolling window (e.g., 2 in 7d)
4. Correlates against `incidents.jsonl` to emit only NEW recurrences
5. Outputs: `{pattern_id, recurrence_count, window_days, evidence_links[]}`
6. Dry-run mode: logs proposed actions without filing tickets

**Acceptance Criteria**:
- [ ] AC1: Script runs in Free lane (GitHub REST API v3, no Premium models)
- [ ] AC2: Detector handles 8 seed patterns (from R&D table) with configurable thresholds
- [ ] AC3: Dry-run mode outputs 5+ test cases (mixed patterns, edge cases)
- [ ] AC4: Idempotent: running twice on same incident data produces single proposal, not duplicate
- [ ] AC5: Graceful degradation if GitHub API rate-limited or incidents.jsonl missing
- [ ] AC6: Logs include evidence links (GitHub run IDs, PR numbers)

**Dependenc ies**: None (new script)

**Related**: R&D Finding F1, F2, F4 | Pattern catalog creation (Ticket D-1133-02)

---

### Ticket D-1133-02: Pattern Catalog & Schema (`recurring-patterns.json`)

**Title**: Define canonical recurring-pattern catalog with extensibility

**Type**: Task | **Story Points**: 5 | **Epic**: #1133

**Description**:
Create `instructions/recurring-patterns.json` with all 8 seed patterns from Epic scope:
1. CHANGELOG.md merge conflicts
2. Branch-name validation rejections
3. Lint >100 lines on same path
4. Evidence-completeness 60s race
5. Admin signer non-independence
6. Pre-commit hook failure → amend instead of commit
7. Signature variance (operator handle vs registry alias)
8. Worktree governance violations

Each pattern entry includes:
- `id`, `name`, `description`
- `detection_regex` (to match in logs/PR titles)
- `threshold_global` (N occurrences), `threshold_window_days` (M day window), `threshold_multiplier`
- `proposed_remediation` (short text for anneal ticket)
- `related_tickets[]` (e.g., #1132 for CHANGELOG fix)
- `enabled` flag, `created_date`

**Acceptance Criteria**:
- [ ] AC1: All 8 patterns from Epic scope documented with rationales
- [ ] AC2: Schema supports `threshold_multiplier` for context-aware tuning
- [ ] AC3: Regex patterns tested against 3+ historical incident examples from repo
- [ ] AC4: Documentation includes guidance for adding new patterns (new_pattern=candidate workflow)
- [ ] AC5: File validates against JSON schema (lintable)
- [ ] AC6: Version-controlled in repo; changes tracked and auditable

**Dependencies**: None (config file)

**Related**: R&D Finding F4 | Ticket D-1133-01 (detector consumes this catalog)

---

### Ticket D-1133-03: Incidents JSONL Persistence & Rotation

**Title**: Implement cross-session incident log with rotation policy

**Type**: Task | **Story Points**: 5 | **Epic**: #1133

**Description**:
Create `~/.megingjord/incidents.jsonl` infrastructure:
1. Append-only JSONL format; each line is immutable record
2. Schema: `{timestamp, pattern_id, window_start, count, evidence[], status, suppression_until}`
3. In-memory index on startup: `Map<pattern_id, List<timestamps>>` for O(1) lookups
4. Rotation policy: Archive to `.jsonl.YYYYMMDD` when file > 10MB or > 30 days old; keep last 3 archives
5. Nightly cron task: Rotate if needed, rebuild in-memory index
6. Backward-compatible: graceful handling if file missing (creates fresh on first run)

**Acceptance Criteria**:
- [ ] AC1: JSONL appends are atomic (no partial writes on crash)
- [ ] AC2: Index rebuild completes in <100ms for 10k events
- [ ] AC3: Rotation preserves all events; oldest archive deletable after 90d retention
- [ ] AC4: Deduplication works: same pattern in same window produces one entry, not duplicate
- [ ] AC5: Suppression entries expire per `suppression_until` timestamp
- [ ] AC6: Privacy audit: incidents.jsonl contains NO secrets, NO PII, only ticket #s + pattern IDs

**Dependencies**: Ticket D-1133-01 (detector writes to incidents.jsonl)

**Related**: R&D Finding F3 | Ticket D-1133-04 (operator CLI reads incidents.jsonl)

---

### Ticket D-1133-04: Operator Review CLI (`anneal:review` command)

**Title**: Interactive batch CLI for reviewing + approving anneal proposals

**Type**: Task | **Story Points**: 8 | **Epic**: #1133

**Description**:
Develop `npm run anneal:review` interactive CLI that:
1. Queries incidents.jsonl for status=proposed entries
2. Presents each in batch prompt: pattern name, recurrence count, evidence links, proposed fix
3. Operator chooses: accept (auto-file proposal), reject (suppress), or skip
4. Updates incidents.jsonl with status=accepted|rejected + suppression_until timestamp
5. After batch, summarizes actions and next steps

Flow example:
```
? Found 3 pending anneal proposals. Review them now? (Y/n)

1️⃣  CHANGELOG.md merge conflicts (appeared 2x in last 7d)
    Evidence: PR #1123, PR #1124
    Related: #1132 (fragments fix)
    Remediation: Switch CHANGELOG to per-ticket fragments
    Accept anneal proposal ticket? (Y/n/suppress[7d]) 
```

**Acceptance Criteria**:
- [ ] AC1: CLI uses interactive prompts (not one-off flags); supports batch workflow
- [ ] AC2: Each proposal shows pattern ID, count, evidence links, remediation hint
- [ ] AC3: Operator can accept (file proposal), reject (add to suppression list), or skip (defer)
- [ ] AC4: Suppression entries persist to incidents.jsonl with TTL (e.g., 7 days)
- [ ] AC5: Summary report at end (X approved, Y rejected, Z suppressed)
- [ ] AC6: No external APIs required; uses local incidents.jsonl + GitHub API for evidence links only

**Dependencies**: Ticket D-1133-03 (persistence), Ticket D-1133-02 (patterns)

**Related**: R&D Finding F6 | Operator governance gate

---

## Milestone B: Cross-Session Memory & Governance Integration (Copilot Team)

### Ticket D-1133-05: Nightly Cron Task Setup

**Title**: Schedule recurring pattern detection + incident rotation

**Type**: Task | **Story Points**: 3 | **Epic**: #1133

**Description**:
1. Add GitHub Actions workflow or cron entry in `.megingjord/` to run detector nightly (e.g., 02:00 UTC)
2. Trigger: `npm run workflow:anneal:detect -- --mode shadow` (shadow=dry-run for first 2 weeks)
3. Post-run: Check if incidents.jsonl needs rotation; rotate if needed
4. Logging: Emit metrics to HAMR (per #1130 coverage) or direct to logs if HAMR unavailable
5. Error handling: Graceful fallback if GitHub API rate-limited; retry with exponential backoff

**Acceptance Criteria**:
- [ ] AC1: Scheduled task runs nightly without manual intervention
- [ ] AC2: Runs in Free/Fleet lane (no Premium model cost)
- [ ] AC3: Dry-run mode (first 2 weeks): logs proposed actions without filing
- [ ] AC4: Metrics emitted (or logging fallback) for observability
- [ ] AC5: Cron task survives operator downtime; catches up on next run
- [ ] AC6: Rate-limit handling prevents GitHub API quota burndown

**Dependencies**: D-1133-01 (detector), D-1133-03 (persistence)

**Related**: #1130 (HAMR), #1113 (Goal Health Score sensor)

---

### Ticket D-1133-06: Integration with Goal Health Score (#1113)

**Title**: Add recurring-failure-rate sensor to multi-layer self-annealing system

**Type**: Task | **Story Points**: 5 | **Epic**: #1133

**Description**:
1. Export metric: `recurring_failure_rate = (patterns_proposed_count_7d) / (total_workflow_runs_7d)`
2. Feed into #1113's Goal Health Score as sensor: `"recurring_failure_rate"`
3. Define thresholds: if rate > 15%, escalate to Actuator-7 (anneal frequency bump)
4. Dashboard panel: live recurring-pattern queue (count + pending age)
5. Integration testing: synthetic failing patterns trigger correct sensor value + escalation

**Acceptance Criteria**:
- [ ] AC1: Metric exported in OpenTelemetry format (or HAMR substrate)
- [ ] AC2: Goal Health Score consumes `recurring_failure_rate` as sensor input
- [ ] AC3: Escalation triggers when rate > 15% (tunable)
- [ ] AC4: Dashboard shows real-time pending anneal proposals + age
- [ ] AC5: Synthetic test: inject 3 CHANGELOG conflicts → see metric spike + dashboard update
- [ ] AC6: No circular dependency between detector and #1113 (one-way data flow)

**Dependencies**: D-1133-01, D-1133-03, Epic #1113 (Goal Health framework)

**Related**: R&D Finding F5 (actuator matrix)

---

### Ticket D-1133-07: Dependency Graph Visualization (#1125 Linkage)

**Title**: Visualize pattern → anneal-ticket → fix-ticket remediation chain

**Type**: Task | **Story Points**: 5 | **Epic**: #1133

**Description**:
1. Add pattern-ID node to #1125's dependency graph (AI-augmented dependency landscape)
2. Edges: Pattern sig → Anneal ticket → Related fix ticket (e.g., #1132 for CHANGELOG)
3. Visualization: Mermaid diagram or dashboard showing remediation chain
4. Query support: "Show all patterns + their fix status"
5. Example: `CHANGELOG_conflict → #1132-anneal → #1132-fix` linked in graph

**Acceptance Criteria**:
- [ ] AC1: Pattern nodes added to graph with unique IDs
- [ ] AC2: Edges to anneal proposals + related fix tickets
- [ ] AC3: Visualization shows remediation status (proposed → accepted → closed)
- [ ] AC4: Query API: get all patterns + fix status for dashboard
- [ ] AC5: Metadata includes evidence count + operator approval status
- [ ] AC6: Synced with incidents.jsonl; graph reflects latest proposals

**Dependencies**: D-1133-01, D-1133-03, Epic #1125 (graph infrastructure)

**Related**: R&D Finding F5

---

## Milestone C: Validation & Scaling (Shared Effort)

### Ticket D-1133-08: Synthetic Test Harness for Validation

**Title**: Create repeatable test suite for pattern detection + proposal workflow

**Type**: Task | **Story Points**: 5 | **Epic**: #1133

**Description**:
1. Mock GitHub API responses with synthetic failure scenarios (3 CHANGELOG conflicts, 2 lint failures, etc.)
2. Test detector output: correct pattern ID, threshold crossed, evidence links populated
3. Test operator CLI: accept/reject/suppress flows update incidents.json correctly
4. Test idempotency: running detector twice on same incident produces single proposal
5. Test edge cases: empty incidents.jsonl, network timeout, malformed pattern regex
6. Validation gate: At least one real synthetic pattern triggers correct detection + CLI workflow

**Acceptance Criteria**:
- [ ] AC1: Test suite covers all 8 seed patterns (at least one synthetic failure per pattern)
- [ ] AC2: Detector output validated against expected schema + values
- [ ] AC3: CLI workflow (accept/reject/suppress) tested; incidents.jsonl updated correctly
- [ ] AC4: Idempotency verified: 2x runs on same data → single proposal
- [ ] AC5: Edge cases handled gracefully (missing API, malformed regex, etc.)
- [ ] AC6: CI/CD integration: tests run on PR merges; failure blocks merge

**Dependencies**: D-1133-01, D-1133-02, D-1133-03, D-1133-04

**Related**: Acceptance Criteria AC8 from Epic #1133 (validation phase)

---

## Delivery Sequence & Team Assignments

**Phase 1 Execution** (Copilot Team owns; Codex assists with graph integration):

1. **Week 1**: D-1133-02 (catalog) + D-1133-03 (persistence)  
   → Unblock detector design
2. **Week 2**: D-1133-01 (detector engine) + D-1133-04 (CLI)  
   → Core functionality
3. **Week 3**: D-1133-05 (cron) + D-1133-08 (tests)  
   → Operational readiness
4. **Week 4**: D-1133-06 (#1113 integration) + D-1133-07 (#1125 graph)  
   → Governance integration

**Cross-Epic Dependencies**:
- **Blocks on #1130**: If HAMR coverage incomplete, metrics fallback to direct logging (not blocked, just degraded)
- **Blocks on #1113**: Goal Health Score framework must exist before D-1133-06 (design now, implement later OK)
- **Blocks on #1125**: Dependency graph nodes; can design D-1133-07 in parallel with graph engine

---

## Success Metrics (from Epic #1133 ACs)

✅ **AC2**: `scripts/global/workflow-anneal-detect.js` runs as scheduled  
✅ **AC3**: Pattern catalog v1 covers 8 seed patterns  
✅ **AC4**: incidents.jsonl persists across sessions  
✅ **AC5**: Auto-filed anneal tickets carry standardized format + evidence  
✅ **AC6**: Operator review CLI: `npm run anneal:review`  
✅ **AC7**: Suppression list respects rejection + TTL  
✅ **AC8**: Synthetic test proves detection + proposal workflow  
✅ **AC9**: governance-audit + dashboard consume pattern signals  

---

## Recommendations for Peer Review (cc, cx teams)

1. **Threshold tuning**: R&D proposes 2-in-7d global + multipliers; peer feedback welcome on multiplier values
2. **Cost efficiency**: Recommend Free lane throughout (GitHub API v3, no LLM invocation); confirm with peers
3. **Operator workflow**: Interactive CLI vs. webhook-driven alerts — R&D chose batch CLI; discuss trade-offs
4. **Integration sequencing**: #1113 & #1125 must ship first (infrastructure); this Epic depends but not blocked

---

**Authored by**: Nova Harper (Copilot Team)  
**Date**: 2026-05-09  
**Evidence**: R&D findings + 15 websearch sources + repo anchors  
