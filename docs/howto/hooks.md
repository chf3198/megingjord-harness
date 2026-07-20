# Hooks — operator reference

Governed hook scripts live in `hooks/scripts/` and deploy to runtime homes via
`npm run deploy:apply` / `npm run deploy:cursor:apply`. See
[hook-parity-check.md](hook-parity-check.md) for cross-runtime parity verification.

## Baton sequencing (#3204, extends #2876)

On ticket branches (`feat/<N>-*` / `fix/<N>-*`), the first file edit in a session
requires:

1. **Authoritative `MANAGER_HANDOFF`** on the linked issue — the **latest**
   handoff must include `worktree_branch:` matching the current branch.
2. **Collaborator phase** — auto-promoted to `collaborator` on first edit when
   authoritative handoff exists (`pretool_guard.py` + `userprompt_gate.py`; #3206).

Implementation: `hooks/scripts/baton_handoff_checks.py`, wired from
`pretool_guard.py`, `userprompt_gate.py`, and `tool_activity.py`.

Stale historical handoffs without `worktree_branch:` no longer satisfy the gate.

## Key scripts

| Script | Role |
|--------|------|
| `pretool_guard.py` | Pre-edit and admin sequencing gates |
| `manager_ticket_gate.py` | Ticket-first on Manager scope |
| `userprompt_gate.py` | Finish-intent and baton phase promotion |
| `baton_handoff_checks.py` | Branch-scoped MANAGER_HANDOFF authority |
| `client_arbitration_guard.py` | Detects a non-carve-out client-defer and builds the adjudication-redirect |
| `stop_reminder.py` | Stop hook — blocks + actively redirects a client-defer into the cross-model panel |

See [pre-push-gates.md](pre-push-gates.md) for push/merge gate ordering.

### Client-defer → adjudication redirect (#3749)

The Stop hook does not merely detect a client-defer — it **actively redirects** it.
`client_arbitration_guard.detect_client_arbitration` flags **any** non-carve-out deferral
of an internal decision to the client (broadened in #3749 beyond the old conflict-keyword
regex: `FORBIDDEN_ASK AND NOT human_carveout`). On a hit, `stop_reminder.py` blocks the stop,
emits a `client-defer-routed-to-adjudication` incident (G8), and prints the exact
`adjudication-guardrail.decide()` invocation the operator must run — routing the decision to
the **free cross-model panel**, never the client. The 4 human carve-outs (design/UAT,
irreversible, security-weakening) are the sole sanctioned client escalation and are never
redirected. Complements `stuck-state-detector.js` (#3748), which routes execution-state
stuck triggers into the same panel.

## Merge gate — real-PR verification (#3344)

The `pretool_guard.py` admin-merge gate keys `admin_ops.pr_create` by
`sha1(cwd)+session`. Under cwd-churn (session cwd on `main` while the work lives
in a linked worktree) that flag can be lost, which previously produced a false
"PR creation not recorded" block on a genuine, CI-green PR.

The gate now degrades safely: when `pr_create` is unrecorded it extracts the PR
ref from the merge command and verifies a **real OPEN PR** via a read-only
`live_checks.open_pr_for_ref()` lookup. The merge is allowed **only** on a
confirmed-OPEN PR; it **fails closed** (retains the block) when no PR exists or
the lookup is indeterminate (gh non-zero / timeout / absent). The gate stays
honest — it still blocks a merge that truly has no PR — while no longer
stranding a legitimate Admin merge on lost session state.

## Pre-commit: operator-memory promotion advisory (#2686, Epic #2399 AC5)

A `pre-commit` lefthook runs `scripts/global/feedback-memory-promotion-check.js`.
When a commit **adds** a new operator-memory `feedback_*.md` file (git `A` status,
matched by basename under a `memory` directory segment incl. `.claude/**/memory`),
the check prints an advisory prompting the operator to consider promoting the
rule-of-thumb to canonical `instructions/` (or `wiki/wisdom/global/concepts/`) per
the Epic #2399 pattern.

It is **advisory only** — it always exits 0 and never blocks a commit — and
**idempotent**: it fires only on new additions, never on modified or pre-existing
files. Bypass with `FEEDBACK_MEMORY_CHECK_BYPASS=1`.

## Post-merge worktree teardown actuation (#3357, Epic #3352)

A `post-merge` lefthook runs `scripts/global/worktree-teardown-actuate.js --apply` so that when a
squash-merge lands on `main` locally, any now merged-and-clean worktree is torn down automatically.
It executes `git worktree remove` **without `--force`** — git's own dirty-guard is the authoritative
final gate, so a worktree with uncommitted or unmerged work is refused, never force-removed. Each
teardown emits a redacted v3 audit record (decision + `git worktree remove` exit code/stderr) to the
observability surface. Preview without removing via `npm run worktree:teardown` (dry-run default).

## Stuck-state Stop hook (#3766, live wiring of #3748)

A `Stop` hook `hooks/scripts/stuck_state_gate.py` wires the shipped, ADVISORY stuck-state detector
(#3748) into production. On each turn-end it derives the available behavioral signals (an explicit
stuck marker in the assistant text, or pre-computed counters a runtime supplies under `stuck_signals`)
and delegates detection + carve-out routing to the Node bridge
`scripts/global/stuck-state-hook-bridge.js`, which reuses `stuck-state-detector.detectStuckState` and
`adjudication-guardrail.classifyDecision` — no detection logic is duplicated.

- **Advisory, never blocks.** A detected stuck-state emits guidance to route into the cross-model
  adjudication panel (`adjudication-guardrail.decide()`) **without a client prompt**; the hook always
  exits 0, independent of replay-eval promotion state (advisory→blocking promotion is deferred per the
  #3748 panel). The synchronous bridge path (`classifyDecision`) keeps the hook inside its timeout and
  works offline (G6).
- **Escalation is carve-out-only.** A genuinely irreversible / high-destructive gate routes to
  `human-carveout` — the only sanctioned client escalation (the 4 retained touchpoints).
- **Companion to `client_arbitration_guard.py` (#3749), not a duplicate:** that guards explicit
  client-defer *language*; this guards *behavioral* stuck-state signals (loop / iteration-cap /
  token-budget / tool-error burst / self-consistency divergence / explicit signal).
- **Observability (G8):** each detection appends a schema-v3 event
  (`event: governance.stuck_state_detected`, `advisory: true`) to the events surface
  (`MEGINGJORD_STUCK_EVENTS`, default `~/.megingjord/stuck-state-events.jsonl`).
- Path resolution prefers `MEGINGJORD_REPO_ROOT/scripts/global`, falling back to the deployed
  `~/.copilot/scripts/global`. Tests: `tests/stuck-state-hook-bridge.spec.js`,
  `tests/stress-stuck-state-hook-bridge.spec.js`, `tests/test_stuck_state_gate.py`.

## Ask-time reference monitor (#3825, Epic #3822 C1 — Gap A)

A deterministic `PreToolUse` branch in `pretool_guard.py` (right after `tool = ...`)
intercepts the operator's **own** `AskUserQuestion` tool call **before** the client is
prompted — the enforced fix for the over-escalation class (#3814: the operator asked the
client A/B/C on a *reversible* decision when only the security-weakening branch was a
genuine carve-out). It reuses the in-process classifier `hooks/scripts/ask_reference_monitor.py`
(regex/string only, ≤~50 ms — no node/network in the hook) to route on **reversibility vs
the 4 retained carve-outs** (`config/retained-human-touchpoints.json`):

- **genuine carve-out** (design / UAT / irreversible / security-weakening) → `emit("ask")`
  — the client is the correct authority (unchanged behavior).
- **reversible, non-carve-out** → `emit("deny")` + redirect to the free cross-model panel
  (`adjudication-guardrail.js` `decide()` / `fleet-decision-oracle.js`) — **silent, zero
  client ceremony** (anti-confirmation-fatigue; approval fatigue is a security bug).
- **unknown / ambiguous** → fail-safe `emit("deny")` + adjudicate to the panel (never a
  silent allow, never a bare client prompt).
- **classifier error** → fail-closed `emit("ask")` (reach the human), mirroring the S6/S7 posture.

**Anti-drift:** a config-parity test asserts every `retained-human-touchpoints.json`
carve-out id has a monitor pattern. **Registration:** the new `emit("ask")` reasons are
listed in `sanctioned_ask_surfaces` so `client-prompt-surface-check.js` recognizes them and
flags any *future* unregistered ask surface. **Observability (G8):** a single metadata-only,
redacted telemetry line (route + carve-out-class-or-null + prompt-sha256 — **never** raw
text) is appended to `~/.megingjord/ask-redirect.jsonl`. Tests:
`tests/hooks/test_ask_reference_monitor_3825.py` (unit + committed-corpus replay + end-to-end
enforcement), `tests/hooks/stress_ask_reference_monitor_3825.py` (fault-injection + p99 budget),
with JS harnesses `tests/pretool-guard-ask-monitor-3825.spec.js` +
`tests/stress-ask-reference-monitor-3825.spec.js`.
