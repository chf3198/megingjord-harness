# Research: Megingjord Agent Broker — Parallel AI Coding Agent Coordination

**Ticket**: #1084 (Epic #1083)
**Lane**: docs-research
**Date**: 2026-05-07
**Author**: Orla Harper (claude-code:opus-4-7@anthropic, role: collaborator)

## Executive recommendation

Adopt **Design Decision C (hybrid)** with **failover to A (per-host local daemon)** per operator decision. Wave-1 MVP scope: SQLite-backed local broker with HAMR /teams reconciler, focused on the 6 failure modes observed in this session.

---

## A. Architecture (Decision C + A failover)

```
   ┌────────────────────────── PRIMARY (Decision C) ────────────────────────────┐
   │                                                                              │
   │   Local broker (SQLite)         HAMR Worker (/teams + KV)                   │
   │   ─────────────────────         ────────────────────────                    │
   │   • ticket leases               • cross-host reconciler                     │
   │   • file leases                 • lease conflict signal                     │
   │   • worktree allocator          • dirty-quarantine state                    │
   │   • dirty quarantine                                                         │
   │   • diff-aware visual QA                                                     │
   │           │                              │                                  │
   │           └─────── reconcile ────────────┘                                  │
   │                                                                              │
   └──────────────────────────────────────────────────────────────────────────────┘
   
   Authority: GitHub is canonical for ticket lifecycle.
              Local broker is canonical for in-flight work coordination
              (lease + worktree + file paths).
              HAMR /teams is canonical for cross-host visibility.
   
   ┌────────────────────────── FAILOVER (Decision A) ───────────────────────────┐
   │                                                                              │
   │   When HAMR /teams is unreachable:                                          │
   │   • broker continues on local SQLite only                                   │
   │   • lease conflicts caught locally (single-host scope)                      │
   │   • cross-host coordination degrades to "no awareness"                      │
   │   • on HAMR restore, broker syncs deltas to /teams                          │
   │                                                                              │
   │   Detection: HAMR /healthz probe failure → degraded mode flag set            │
   │   Recovery:  successful /teams write after backoff → flag cleared           │
   │                                                                              │
   └──────────────────────────────────────────────────────────────────────────────┘
```

## B. Lease schema

```
   ticket_lease {
     ticket_id:       integer (GitHub issue #N)
     branch:          text (one-ticket-per-branch invariant)
     agent:           text ("claude-code"|"copilot"|"codex"|"cursor")
     model:           text ("opus-4-7"|"gpt-5"|...)
     session_id:      uuid
     acquired_at:     iso_ts
     ttl_ms:          integer (default 30 min, refresh on heartbeat)
     last_heartbeat:  iso_ts
     pr_number:       integer | null
     status:          "active" | "stale" | "released" | "quarantined"
   }
   
   file_lease {
     ticket_id:    integer (FK to ticket_lease)
     glob:         text (e.g., "scripts/wiki/**", "config/litellm-config.yaml")
     mode:         "exclusive" | "shared-read"
     acquired_at:  iso_ts
   }
   
   quarantine_record {
     id:              uuid
     reason:          "dirty-checkout" | "stale-lease" | "conflict"
     stash_ref:       text (git stash@{N} or worktree path)
     original_branch: text
     created_at:      iso_ts
     resolved_at:     iso_ts | null
   }
```

## C. CLI contract (broker is invoked by every agent at session start)

```
   # 1. Agent requests ticket lease + worktree
   $ broker acquire --ticket 866 --agent claude-code --files "scripts/wiki/**"
   → returns: { lease_id, worktree_path, branch, ttl_ms }
   → side effects: creates worktree at .megingjord/worktrees/866-<lease_id>;
                   checkout branch feat/866-<slug>; refresh local SQLite;
                   POST /teams/<host>/leases on HAMR (best-effort)
   
   # 2. Agent heartbeats during work
   $ broker heartbeat --lease <id>
   → refreshes ttl; updates local + HAMR
   
   # 3. Agent releases at handoff/close
   $ broker release --lease <id> [--quarantine]
   → marks lease released; cleans worktree (or moves to quarantine on uncommitted)
   
   # 4. Status view
   $ broker status [--mine|--all|--ticket N]
   → table of active leases, agents, files, branches, PRs, conflicts
   
   # 5. Reconcile from GitHub truth
   $ broker reconcile [--ticket N]
   → polls GitHub issue/PR state; releases leases for closed tickets;
     marks merged-PR worktrees as cleanup-eligible
```

## D. Stop-hook integration

```
   Before stop:
     1. broker reconcile        # sync from GitHub
     2. check active lease      # do I have one?
     3. check file lease overlaps  # any other agent in my files?
     4. check visual_qa needed?   # diff-aware classifier (E)
     5. if dirty: quarantine OR commit
     6. if all clear: emit handoff artifact
   
   Result: stop hook uses BROKER state, not session-state alone.
```

## E. Diff-aware visual QA classifier

```
   def visual_qa_needed(changed_files):
     # UI patterns
     ui_patterns = [
       r'dashboard/.*\.html$',
       r'dashboard/css/.*\.css$',
       r'dashboard/js/.*-panel\.js$',
     ]
     for path in changed_files:
       if any(re.match(p, path) for p in ui_patterns):
         return {'needed': True, 'reason': f'{path} matches UI pattern'}
     return {'needed': False, 'reason': 'no UI files in diff', 'auto_record': 'N/A'}
   
   Stop-hook auto-records visual_qa = N/A for non-UI changes.
   For UI changes, stop-hook requires the standard screenshot evidence.
   
   This eliminates the long-standing false-positive where issue-only
   closeouts trigger visual QA gates on web-app repos.
```

## F. Cross-extension compatibility

| Extension | Entrypoint | Adapter |
|---|---|---|
| Claude Code | `~/.claude/hooks/scripts/broker-bridge.sh` | calls `broker acquire` on session start |
| Copilot | `.github/copilot-instructions.md` snippet | calls `broker acquire` from Copilot setup hook |
| Codex | `~/.codex/hooks.json` (PreToolUse) | calls `broker acquire` |
| Cursor | `.cursorrules` | calls `broker acquire` |
| Continue.dev | `.continue/config.json` | calls `broker acquire` |

The broker exposes a thin REST surface (localhost only) so non-shell extensions can call it via HTTP.

## G. Conflict forecast

```
   On `broker acquire --ticket N --files "<glob>"`:
   
   1. Check open PRs for files matching glob
   2. If overlap found, return:
      {
        ok: false,
        conflicts: [
          { pr: 1085, files: ["scripts/wiki/wiki-llm.js"], status: "open" }
        ],
        suggestions: [
          "wait: rebase after PR #1085 merges (~1 hour ETA)",
          "parallel: acquire anyway; you'll need to rebase later",
          "abort: pick a different file scope"
        ]
      }
   3. Operator chooses; --force flag bypasses warning.
```

## H. Wave-1 MVP child sketch

| # | Effort | Description | Depends |
|---|---|---|---|
| Child 1 | 0.5d | `scripts/global/broker.js` SQLite schema + `acquire`/`release`/`status` commands | — |
| Child 2 | 0.3d | Worktree allocator (`broker acquire` creates `.megingjord/worktrees/<id>`) | Child 1 |
| Child 3 | 0.3d | Dirty-checkout quarantine + stash refs | Child 1 |
| Child 4 | 0.4d | HAMR `/teams/<host>/leases` reconciler (best-effort POST) | Child 1 |
| Child 5 | 0.3d | Diff-aware visual QA classifier (`scripts/global/visual-qa-classify.js`) | — |
| Child 6 | 0.4d | Stop-hook integration: reconcile + lease check before block | Children 1,5 |
| Child 7 | 0.3d | `broker conflict-forecast` against open PRs | Child 1 |
| Child 8 | 0.3d | CLI status view + tests | Child 1-7 |
| **Total** | **~2.8d** | | |

Wave-1 ships Children 1+2+3+5+6+8 (core broker + visual-QA + status). Children 4+7 (HAMR reconciler + conflict forecast) ship as Wave-1.5 once Wave-1 stabilizes.

Out of Wave 1 scope (deferred to Wave 2):
- Cursor / Continue.dev adapters (just claude-code + copilot + codex)
- Merge-queue bridge
- Rich dashboard panel (CLI status table only)

## I. Failure-mode coverage

| Session-observed failure | Wave-1 fix |
|---|---|
| Branch reset orphaned commit | broker.acquire creates own worktree; no shared checkout |
| R9.2 wrong-branch push | broker enforces branch = lease.branch on every push |
| PR 60s race | Stop-hook reconciles before block; handoff timing computed pre-PR |
| Branch≠Refs gate failure | broker.acquire takes ticket# explicitly; branch is auto-derived |
| Post-hook formatter reverts | OUT OF SCOPE — separate child (recommendation 6 from analysis) |
| Sandbox sync drift | broker reconcile includes sandbox/* branch sync |

## J. Authority semantics (per Decision C)

```
   Conflict scenarios + resolution:
   
   1. Local broker says "lease active for #N", GitHub PR for #N is MERGED
      → reconcile detects MERGED → release lease automatically
   
   2. Local broker says "no lease", HAMR /teams says "another host has lease"
      → broker WARNS but doesn't block (other-host might be stale)
      → operator confirms before acquire
   
   3. Local broker SQLite corrupt
      → degrade to "advisory only" mode; rebuild from worktree disk state
      → log warning; continue
   
   4. HAMR Worker offline
      → degraded mode flag set
      → broker continues local-only (Decision A failover)
      → on restore: deltas push to /teams
```

## K. Risk register

| Risk | Mitigation |
|---|---|
| Broker SPOF (process crashes mid-work) | SQLite WAL mode; lease TTL with heartbeat; recovery on restart |
| Non-compliant extension bypasses broker | Pre-commit hook checks for active lease; warns if missing (best-effort enforcement) |
| HAMR-host network partition | Decision A failover; local-only mode preserves single-host correctness |
| Visual-QA false negative (UI change misclassified) | Whitelist patterns are conservative; auto-records N/A only on clear non-UI diffs; manual override available |
| Lease TTL too short → premature release during long work | Heartbeat default 5min; TTL default 30min; configurable per-ticket |

## L. Acceptance criteria for Epic #1083

- [ ] Broker CLI installed (`scripts/global/broker.js`) + tests
- [ ] SQLite schema migration handled (`.megingjord/broker.db`)
- [ ] Worktree allocator creates per-lease directory
- [ ] Dirty-checkout quarantine functional
- [ ] Stop-hook reconciles via broker before blocking
- [ ] Diff-aware visual QA auto-records N/A for non-UI diffs
- [ ] `broker status` CLI shows active leases with agent + files + branch + PR
- [ ] HAMR `/teams/<host>/leases` reconciler (best-effort, decision-A failover working)
- [ ] Documented entrypoints for Claude Code + Copilot + Codex
- [ ] All Wave-1 dev children closed via baton
- [ ] R&D doc + this design doc preserved at `research/agent-broker-architecture-2026-05-07.md`

## Conclusion

Decision C + A failover gives single-host correctness even when HAMR is unreachable, while supporting cross-host coordination as the primary path. Wave-1 MVP focuses on the 6 session-observed failures; deferred features (rich dashboard, full extension matrix, merge-queue bridge) ship in Wave-2 once MVP stabilizes.
