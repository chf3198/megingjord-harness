---
title: "State-authority architecture for Megingjord baton (Phase-0 RD)"
date: 2026-05-30
epic: 2451
ticket: 2452
lane: docs-research
test_strategy: peer-review
status: draft
---

# State-authority architecture for Megingjord baton

## Problem statement

Megingjord's baton state lives in two stores that drift:

1. **GitHub** (canonical): issue labels + 4 named handoff artifact comments
2. **Local cache** (derivative): `~/.copilot/hooks/state/repo-<hash>[-session].json` with `roles{}`, `flags{}`, `admin_ops{}`

When the derivative store desyncs from the canonical store, the Stop hook reports false-positives that operators learn to bypass by patching the cache. The bypass is correctly blocked by the auto-mode safety classifier as "Self-Modification not authorized by the user," leaving operators stuck. Pre-#2444, this happened on every code-session close.

## Failure-class evidence (last session, 2026-05-30)

| Trigger | Class | Resolution required |
|---|---|---|
| Orphan wiki stubs as untracked files for ~10 days | dual-file state stale-read | Filed #2441 |
| `roles["admin"]` never auto-set despite full admin baton | local-cache vs GitHub-label desync | Filed + shipped #2444 |
| State-file patch rejected by safety classifier | auto-mode classifier (working as designed) | Required explicit client authorization |
| `gh pr merge` returned "Base branch was modified" | cross-team merge race absent serialization | Retried with admin override |

Memory anchors documenting this class: 8+ entries (state-store-dual-variants, admin-ci-gate, admin-authority-and-baseline-drift, bash-sleep-block-recovery, all-baton-artifacts-before-pr, baton-artifact-format-pitfalls, prose-collision-non-baton-comments, team-model + role-colon + flaw-emission prose-collision triplet).

## 2026 industry context

### MCP went stateless at the protocol layer (2026 spec)

Per the [MCP 2026 roadmap](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/), the Model Context Protocol removed protocol-level sessions in 2026. Stateful applications mint **explicit handles** from tools that the model passes back as ordinary arguments. Quote: "this pattern has proven more powerful than externally managed session state, as the model can compose handles across tools, reason about them, and hand them off between steps in ways that hidden session metadata never allowed." This is the exact pattern proposed for Megingjord's `derive_roles_from_github(ticket_n)` resolver — GitHub issue numbers are the explicit handle; local state metadata goes away.

### A2A reached production at 150+ orgs in year one

The [Agent2Agent (A2A) protocol](https://a2a-protocol.org/latest/) shipped v1.0 in early 2026, reached v1.2 by mid-year, and as of April 2026 has 150+ organization adopters including Microsoft, AWS, Google, Salesforce, SAP, ServiceNow, Workday, and IBM. A2A defines signed agent cards using cryptographic signatures for domain verification — directly applicable to Move 3 (cross-team merge-claim primitive) where team identity needs verification before claim acquisition.

### GitHub Agentic Workflows + IssueOps formalized in 2026

[GitHub Agentic Workflows](https://github.blog/engineering/issueops-automate-ci-cd-and-more-with-github-issues-and-actions/) shipped technical preview Feb 13, 2026. The IssueOps pattern explicitly uses GitHub Issues and PRs as a source of truth: "every action leaves a record, keeping everything structured, automated, and auditable right inside GitHub. All actions taken on an issue are logged in its timeline." This is precisely the model Move 1 proposes — Megingjord becomes an IssueOps consumer rather than a parallel-state author.

### GitHub merge-queue race incident (March 14, 2026)

A [GitHub merge queue race condition](https://johal.in/postmortem-github-2026-merge-queue-bug-caused-conflicting/) on 2026-03-14 caused 17 conflicting deployments across 4 Fortune 500 enterprises, ~$2.1M downtime. Concurrent merge group validations skipped conflict checks when creation timestamps fell within 200ms of each other. Mitigation: distributed lock keyed on logical resource, re-check state once acquired. This validates Move 3 with industry evidence — even GitHub's own merge queue hit the race we observed locally.

### LangGraph + Microsoft Agent Framework state-management taxonomy

Per [2026 multi-agent framework comparisons](https://gurusup.com/blog/best-multi-agent-frameworks-2026), state management splits 3 ways: checkpointed (LangGraph time-travel), ephemeral (CrewAI default), event-sourced (Microsoft Agent Framework, ESAA). LangGraph ships built-in checkpointers for Postgres and Redis. [Microsoft Agent Framework MAF 1.0](https://cohorte.co/blog/designing-graph-native-ai-workflows-with-microsoft-agent-framework) (April 2026 GA) bakes "events and checkpoints" into its workflow orchestrations. Megingjord today fits none of these cleanly — it caches without checkpointing, persists without event-sourcing.

### Economics

Independent multi-agent setups carry ~58% token overhead vs single-agent; centralized orchestration ~285%. Multi-agent only pays off when the task genuinely benefits from specialization or critique. Implication: Megingjord's local cache is overhead-without-benefit — derive-from-GitHub is a net token reduction (one API call per Stop hook vs full local-cache maintenance ceremony).

## Verified-vs-unverified source flag

- **VERIFIED**: MCP 2026 roadmap, A2A protocol (multi-source corroboration), GitHub Agentic Workflows, GitHub merge-queue postmortem, LangGraph checkpointer, MAF 1.0
- **UNVERIFIED — DROPPED from Epic body**: "POLARIS framework" claim from initial WebSearch (Feb 2026, typed plan synthesis with compiled policy guardrails). Follow-up search returned only Apache Polaris (data catalog) and Imply Polaris (analytics). Likely WebSearch LLM-summary hallucination. Flagged for adversarial review.
- **NEEDS-VERIFICATION**: ESAA arXiv 2602.23193 — arXiv ID format valid for Feb 2026 but paper itself not independently corroborated. Keep as hypothesis; have red-team verify.

## Proposed 3-move architecture

### Move 1 — Local state file becomes ephemeral read-cache (60s TTL)

Replace `state_store.load_state(cwd)` baton-state reads with `derive_roles_from_github(active_ticket_n)`:

```python
def derive_roles_from_github(ticket_n: int) -> dict:
    cached = _ttl_cache.get(f"roles:{ticket_n}", max_age=60)
    if cached: return cached
    issue = gh_view(ticket_n, fields=['labels', 'comments'])
    roles = {
        'manager': 'role:manager' in issue.labels,
        'collaborator': 'role:collaborator' in issue.labels,
        'admin': 'role:admin' in issue.labels,
        'consultant': 'role:consultant' in issue.labels,
    }
    _ttl_cache.set(f"roles:{ticket_n}", roles, ttl=60)
    return roles
```

Local cache becomes ephemeral read-only TTL store; no writes from baton transitions. Closes the dual-file desync class entirely.

### Move 2 — Event-source the baton for audit + replay

Append every baton transition to `~/.megingjord/baton-events.jsonl` (schema v3 per [observability instructions](../instructions/observability.instructions.md)):

```jsonl
{"ts":"2026-05-30T22:00:00Z","version":3,"service":"baton","event":"role-handoff","from":"collaborator","to":"admin","ticket":2452,"signer":"Orla Harper","trace_id":"...","session_id":"..."}
```

Used for replay/audit/eval-harness. **Never used for live gate decisions** — those derive from GitHub. Matches OWASP OA9 (Human-Agent Trust Exploitation) audit requirement.

### Move 3 — Cross-team merge-claim primitive in HAMR Worker

New HAMR endpoints (DPoP-authenticated per existing HAMR contract):

```
POST /merge-claim/acquire/{ticket-n}   → {claim_id, ttl_s: 60}
POST /merge-claim/release/{claim_id}   → ack
GET  /merge-claim/status/{ticket-n}    → {held_by_team, expires_at}
```

Admin role acquires claim before `gh pr merge`; releases after merge or on failure. Uses Cloudflare KV with TTL; consensus via Cloudflare's strongly-consistent KV. Closes silent merge-race retries.

## Adjacency map

- **#2091** (state isolation per-session+per-worktree, P1 dormant): solved adjacent problem (which cache file gets read). Move 1 makes #2091's solution unnecessary by removing the writable cache. Recommendation: close #2091 as **superseded** if Epic #2451 ships.
- **#1297** (Policy-as-Code substrate eval, P3 backlog): solves adjacent problem (rule expression language). Complementary: Move 1 changes the state the rules read; #1297 changes the language the rules are written in. Both can ship independently.
- **#2444** (closed today): immediate band-aid for `roles["admin"]` not auto-set. Move 1 makes the band-aid moot (no more local `roles["admin"]` to set).

## Open questions for Phase-1 children

1. Resolver implementation language: Python (matches existing hook stack) or Node.js (matches `scripts/global/`)?
2. Offline fallback contract: (a) stale-cached state + warning, (b) hard-block, (c) advisory + pass?
3. HAMR merge-claim auth: DPoP (matches existing endpoints) or lighter token?
4. Migration order: Move 1 → Move 2 → Move 3 serial, or parallel?
5. Deprecation path for 8+ obsolete memory anchors — coordinate with in-flight #2399 (operator-memory promotion)?
6. Schema versioning: how do we evolve `derive_roles_from_github` schema without breaking existing gate consumers?

## Sources

- [The 2026 MCP Roadmap (Model Context Protocol Blog)](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/)
- [Agent2Agent (A2A) Protocol Specification](https://a2a-protocol.org/latest/)
- [Linux Foundation A2A Protocol Project Launch](https://www.linuxfoundation.org/press/linux-foundation-launches-the-agent2agent-protocol-project-to-enable-secure-intelligent-communication-between-ai-agents)
- [GitHub IssueOps: Automate CI/CD with Issues and Actions (GitHub Blog)](https://github.blog/engineering/issueops-automate-ci-cd-and-more-with-github-issues-and-actions/)
- [GitHub Agentic Workflows (Talk Nerdy To Me)](https://www.talk-nerdy-to-me.com/blog/github-agentic-workflows-continuous-ai)
- [GitHub 2026 Merge Queue Bug: K8s 1.32 Deploy Postmortem (johal.in)](https://johal.in/postmortem-github-2026-merge-queue-bug-caused-conflicting/)
- [Best Multi-Agent Frameworks in 2026 (GuruSup)](https://gurusup.com/blog/best-multi-agent-frameworks-2026)
- [Designing Graph-Native AI Workflows with Microsoft Agent Framework (Cohorte)](https://cohorte.co/blog/designing-graph-native-ai-workflows-with-microsoft-agent-framework)
- [LangGraph State Management in Practice (BetterLink)](https://eastondev.com/blog/en/posts/ai/20260424-langgraph-agent-architecture/)
- [Centralized vs Distributed Intelligence for Multi-Agent AI Systems (Mactores)](https://mactores.com/blog/centralized-vs-distributed-intelligence-for-multi-agent-ai-systems)
- [Event-Driven Architecture for AI Agents (Atlan)](https://atlan.com/know/event-driven-architecture-for-ai-agents/)
