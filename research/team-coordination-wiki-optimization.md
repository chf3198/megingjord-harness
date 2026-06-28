# Team Coordination: Karpathy LLM Wiki Optimization
Date: 2026-05-04

## Overview

Epic #866 implementation (#868–#872) requires coordination between **Copilot Team** (implementation lead) and **Claude Code Team** (heavy compute support). This document establishes team boundaries, worktree isolation, and resource routing to prevent conflicts and optimize token usage.

---

## Team Responsibilities

### Copilot Team (Implementation Owner)
- **Scope**: Implement child tasks #868–#872 in `sandbox/copilot` worktree
- **Primary work**: Code changes to:
  - `skills/wiki-retrieval-*.md` (hybrid search + reranking logic)
  - `scripts/wiki-chunking-*.js` (NLP-based document parsing)
  - `scripts/wiki-hygiene-scanner.js` (staleness, dedup, orphan detection)
  - `scripts/wiki-write-safety.js` (concurrency control + provenance)
  - `tests/wiki-retrieval-eval.test.js` (eval harness + CI gates)
- **Branch**: `feat/866-wiki-optimization` (from `sandbox/copilot` → `main`)
- **Token optimization**: Leverage fleet resources (see resource routing) to minimize Copilot API usage
- **Deployment**: Post-merge via `npm run deploy:apply` (non-blocking, via repo)

### Claude Code Team (Compute Support)
- **Scope**: Parallel compute-intensive support in separate `sandbox/claude-code` worktree
- **Primary support**: 
  - Heavy model inference (reranking, embedding generation, semantic similarity)
  - Test data generation for eval harness (#872)
  - Documentation review and synthesis
  - Concurrent write-safety validation (stress testing)
- **Branch**: Separate feature branches in `sandbox/claude-code` worktree (no overlap with Copilot)
- **Token optimization**: Prefer cloud APIs (OpenRouter, Groq, Cerebras) to preserve Copilot token budget
- **No code commits to main**: Support work via gists, research docs, test outputs

### Codex Team (Governance Oversight, if applicable)
- **Scope**: Governance checkpoints (lint, audit, deployment gates)
- **Approval**: Epic #866 status transition `triage` → `ready-for-implementation`
- **Gate**: Requires research #864 closure before child tickets proceed

---

## Worktree Isolation Strategy

**Critical rule**: Each team operates in one live worktree; concurrent branches prevent merge conflicts.

```
/home/curtisfranks/devenv-ops              (main repo, shared CI/CD)
  ├─ sandbox/main                          (main branch, no work)
  
/home/curtisfranks/devenv-ops-copilot      (Copilot team worktree)
  ├─ sandbox/copilot (remote-tracking)
  └─ feat/866-wiki-optimization            (task branch, implementation)
  
/home/curtisfranks/devenv-ops-claude-code  (Claude Code team worktree)
  ├─ sandbox/claude-code (remote-tracking)
  └─ support/866-wiki-compute              (support branch, no code commits)
```

**Safeguards**:
- Each worktree checks out exactly one task branch
- Launcher branches (`sandbox/copilot`, `sandbox/claude-code`) auto-sync to `main` on push (read-only in worktrees)
- No manual merges in worktrees; all merges occur in main repo CI/CD
- Session reset via `bash scripts/worktree-session-start.sh <team> feat/<issue>` (force-updates launcher)

See: [research/concurrent-agent-worktrees-2026-04-24.md](concurrent-agent-worktrees-2026-04-24.md)

---

## Resource Routing (Token Optimization)

**Goal**: Minimize Copilot API usage by routing compute-heavy tasks to fleet resources (Tailscale, cloud APIs).

### Per-Ticket Routing

| Ticket | Primary Task | Fleet Resource | Rationale |
|---|---|---|---|
| #868 | Hybrid retrieval + RRF + reranking | OpenRouter, Groq, Cerebras | Reranking is compute-heavy; offload to cloud APIs; Copilot validates synthesis |
| #869 | NLP chunking + parent-context retrieval | 36gbwinresource (Tailscale) | Dense embeddings & dense retrieval require GPU; Tailscale provides local GPU access |
| #870 | Wiki hygiene scanners (dedup, staleness) | Google AI Studio | Semantic similarity checks; use free-tier API for baseline batches |
| #871 | Write-path concurrency + locking | OpenClaw (Tailscale) | Custom concurrency harness; Tailscale-hosted for multi-agent safety |
| #872 | Eval harness + quality gates | OpenRouter (baseline), 36gbwinresource (retrieval) | Baseline comparisons via cloud; retrieval eval via GPU cluster |

### Implementation Pattern

```javascript
// Example: #868 reranking (offload to cloud)
const rerank = async (candidates) => {
  // Copilot: orchestration
  const request = { candidates, model: 'BGE-reranker-v2-m3' };
  
  // Fleet: heavy compute
  const response = await groq.inference(request); // via OpenRouter → Groq
  
  // Copilot: synthesis + validation
  return validateAndRank(response);
};
```

---

## Coordination Checkpoints

### Pre-Implementation (Sprint 0)
- [ ] Research #864 completed and approved (blocks all children)
- [ ] Copilot worktree `sandbox/copilot` synced to `main`
- [ ] Claude Code team worktree `sandbox/claude-code` provisioned and synced
- [ ] Fleet resources provisioned (Groq API key, 36gbwinresource access, OpenClaw endpoints)
- [ ] This coordination doc posted to Epic #866 comment

### Per-Ticket Handoff
1. Copilot team creates task branch `feat/866-<ticket>` in `sandbox/copilot`
2. Claude Code team provisions compute test environment for same ticket in `sandbox/claude-code`
3. Weekly sync: Compare metrics (latency, accuracy, token usage) across fleet resources
4. No blocking gate; teams work in parallel

### Pre-Merge (Per Ticket)
- [ ] Code review in PR: Copilot + Codex team (governance)
- [ ] Eval tests pass (all metrics above threshold in #872)
- [ ] Fleet resource usage logged and validated (token budgets OK)
- [ ] No merge until parent epic #866 transitioned to `ready-for-implementation`

### Post-Merge (Deployment)
- [ ] Main repo CI/CD runs lint + test suite
- [ ] `npm run deploy:apply` syncs `skills/`, `scripts/` to `~/.copilot/` (non-blocking)
- [ ] Claude Code team reviews deployment output in gist/issue comment
- [ ] Team acknowledges closure (Mark child ticket as `status:done`)

---

## Communication Protocol

### Daily Standup (async, 9am PT)
- Copilot team: 1-line update in Epic #866 comment thread
- Claude Code team: 1-line update in Epic #866 comment thread (if active that day)
- Format: `[<team>] <ticket>: <status>; <blocker if any>`
- Example: `[Copilot] #868: RRF fusion impl 80% done; waiting for Groq rate-limit increase`

### Weekly Sync (15 min video, optional)
- Review token budgets for fleet resources
- Discuss cross-ticket dependencies (if any)
- Escalate blockers to Epic owner (manager)

### Merge Request Notification
- Copilot team posts PR link to Epic #866 comment when ready
- Claude Code team acknowledges in same comment thread (if compute validation needed)
- Codex governance team approves and merges

---

## Conflict Prevention

**Scenario 1: Concurrent writes to same file**
- Worktree isolation prevents this; each team works in separate branches
- Main repo CI/CD merges sequentially (no concurrent commits)

**Scenario 2: Competing fleet resource requests**
- Track quota consumption in `logs/wiki-optimization-resource-usage.jsonl` (append-only)
- If quota exceeded, notify team lead; defer non-critical work to next sprint
- Fallback: Use lower-tier resources (e.g., Cerebras instead of Groq if needed)

**Scenario 3: API rate limiting**
- Groq/OpenRouter/Cerebras may hit rate limits during peak concurrent work
- Mitigation: Copilot team implements request queuing + exponential backoff in skill logic
- Claude Code team pre-generates test data in advance to avoid last-minute API storms

---

## Success Criteria

- ✅ All 5 child tickets (#868–#872) merged to `main` within 2-week sprint
- ✅ Eval harness (#872) shows ≥15% improvement in retrieval accuracy (vs. baseline)
- ✅ Copilot token usage ≤80% of allocated sprint budget (fleet resources absorb remainder)
- ✅ Zero merge conflicts between Copilot and Claude Code team work
- ✅ All code deployments successful (no rollbacks due to orchestration errors)

---

## Escalation Path

- **Blocker**: Post in Epic #866 comment thread, tag `@<manager-alias>`
- **Cross-team conflict**: Manager convenes 15-min sync with both team leads
- **Resource exhaustion**: Manager coordinates with fleet admin for quota increase or deferral
- **Eval metrics miss threshold**: Root-cause in #872 ticket; retry implementation or pivot design

---

## References

- Concurrent worktree pattern: [research/concurrent-agent-worktrees-2026-04-24.md](concurrent-agent-worktrees-2026-04-24.md)
- Deployment model: [.github/copilot-instructions.md](../.github/copilot-instructions.md)
- Fleet topology: [scripts/global/fleet-config.js](scripts/global/fleet-config.js)
- Child ticket details: #868–#872 body/comments

---

**Team&Model**: GitHub Copilot + Claude Haiku 4.5  
**Date**: 2026-05-04  
**Owner**: Manager (Epic #866 lead)  
**Reviewers**: Copilot Team, Claude Code Team, Codex Governance
