# Pre-push gates (Lefthook parity)

## Purpose

Local pre-push runs the same deterministic gate set used for CI lint/governance checks.
This reduces avoidable CI reruns by failing fast before push.

## Install

1. Install dependencies: `npm install`
2. Install hooks: `npm run prepare`
3. Verify config exists: `lefthook.yml`

## Gates executed (parallel)

- branch-name regex check (`hooks/scripts/validate-branch-name.sh`)
- `npm run lint`
- `npm run lint:readability:ci`
- `npm run lint:js` (advisory while legacy baseline warnings are being burned down)
- `npm run lint:md`
- `npm run lint:py`
- `npm run lint:sh` (advisory while legacy baseline warnings are being burned down)
- `node scripts/global/megalint/index.js`
- `node scripts/global/closeout-preflight.js`

### Server-state-only gates (not available pre-push)

Some validators inherently require server-state inputs (PR body labels, PR comments, PR file list) that aren't available pre-push without a round-trip to GitHub. These are documented here for clarity but do NOT run as local pre-push hooks:

- **test-evidence** (`scripts/global/test-evidence-validator.js`) — needs `test_strategy` declared in MANAGER_HANDOFF + per-strategy evidence (spec files in PR diff, evidence comments in trail). Runs server-side via `.github/workflows/test-evidence.yml` on PR open/sync. Prior `--diff-only` invocation was removed (#1613) — the flag was never implemented; the call silently failed under `|| true`.

The local pre-push gate distinction:
- **Blocking gates**: branch-name regex, lint-js, lint-md, lint-readability, megalint, closeout-preflight — these BLOCK push on failure.
- **Advisory gates**: lint-py, lint-sh — these run but suppress failures (`|| true`) while baseline warnings are being burned down.
- **Server-state-only gates**: test-evidence — these CANNOT run locally; documented for operator awareness but not invoked by lefthook.

## closeout-preflight and the deferred-final sequence (#3169)

`closeout-preflight` validates the linked issue's baton artifacts at pre-push. In the
**deferred-final** flow the `CONSULTANT_CLOSEOUT` is meant to cite the PR — which does not
exist yet at first push — so requiring a fully-evidenced closeout pre-push would invert the
baton (forcing teams to post the closeout before the PR). The supported sequence is therefore:

```
commit  ->  push (no PR yet)  ->  open PR  ->  CONSULTANT_CLOSEOUT  ->  merge  ->  close issue
```

To support it, the consultant-closeout check is **deferred to PR-open**:

- **No PR yet, no closeout posted**: `MANAGER_HANDOFF` is still validated, but the
  consultant-closeout check is deferred (a `consultant-closeout deferred to PR-open` line is
  logged). The push is not blocked for a missing closeout.
- **A closeout is already posted early**: it is still validated — deferral relaxes the
  ordering, it never silently un-checks a closeout that is present.
- **The PR exists** (`prBody` resolvable): the consultant-closeout check and
  `merge-evidence-pr-gate` run as before.

Enforcement is preserved downstream regardless: the required CI `consultant-gate`,
`merge-evidence-pr-gate`, and the `pretool_guard` close gate (which requires the merge to be
recorded before `gh issue close`) keep the closeout mandatory **before merge and before issue
close**. The pre-push deferral only removes the baton-inverting pre-PR requirement.

## Manual run

- `npm run hooks:pre-push`

## Emergency bypass

- Git-native bypass: `git push --no-verify`
- Script bypass with explicit warning output:
  - `PUSH_GATES_BYPASS=1 npm run hooks:pre-push`
  - `npm run hooks:pre-push -- --bypass`

Bypass warning includes the full gate list so skipped controls are visible in terminal scrollback.

## CI parity

The lint workflow calls the same command:

- `npm run hooks:pre-push`

This keeps local and CI execution paths aligned.

## Pre-flight admin-override bypass guard (#2706, Epic #2709)

Beyond pre-push, `hooks/scripts/pretool_guard.py` enforces at tool-call time: an
admin-override merge (a PR landed with the `--admin` branch-protection bypass) is
**denied** unless the Epic #2517 exception is already recorded on the active ticket —
the `merge-bypass:admin-exception` label, or a `BLOCKER_NOTE` with `bypass_reason:` +
`approver:` in the PR body. Record the exception **before** the override.

The guard is **fail-closed** (an unverifiable exception denies, never silently allows)
and crash-safe (wrapped in `try/except`, so a guard bug yields a recoverable deny, not
a session brick). This converts the bypass-exception link from a post-merge-only CI
backstop to a pre-flight control — the "prevention over reaction" mandate.

Companion: `scripts/global/gate-failure-tier1.js` auto-emits the Tier-1 incident on an
operator-caused gate failure, so self-anneal escalation no longer depends on the
operator remembering to log it (the gap behind #2703).

## Push-gate commit-step worktree fallback (#3168)

`pretool_guard.py` blocks a `git push` until the Admin commit step is recorded. The flag
is keyed on the **session cwd**, which is typically the main checkout. When governed work
lives in a **linked worktree** but the session cwd is the main checkout (stuck on `main`
with no ticket commits), the recorded flag is unreachable and the gate would falsely block
the push — the recurring "Push blocked: commit step first" desync.

`hooks/scripts/worktree_push_gate.py` resolves the worktree the push actually targets and
accepts the commit step there:

- `resolve_push_cwd` picks the push directory: an explicit `git -C <path>` wins, then a
  leading `cd <path> &&`, otherwise the session cwd.
- `commit_step_satisfied` accepts the push when the session state recorded the commit, OR
  the resolved worktree's state recorded it, OR the branch has a **real commit ahead of
  base** (`origin/main`/`main`) — a cwd-independent signal that fails closed on any git
  error so the session-state check still governs.

When the push is allowed via the worktree fallback rather than the in-session flag, the
guard emits a Tier-1 `incidents.jsonl` event with `pattern_id:
worktree-push-gate-commit-desync` for observability — the fallback is visible, never silent.

## Fleet-review hard-gate (Epic #2192)

The fleet/cross-family red-team review was promoted from an opt-in tool to a hard gate.
Three enforcement surfaces, all registered as `enforced` links in
`config/governance-chains.yml` (`chain-integrity.js` verifies they resolve):

- **fleet-review-required** (`scripts/global/megalint/fleet-review-required.js`, #2738) — a
  `COLLABORATOR_HANDOFF` on a `lane:code-change` ticket must carry a cross-family review
  verdict whose reviewer model family differs from the author's; a 3-fact anti-forgery
  check binds the verdict to the reviewed diff.
- **raw-fleet-curl intercept** (`hooks/scripts/pretool_guard.py` `is_raw_fleet_curl`, #2739) —
  a raw `curl` to a fleet/ollama host (`:11434`, `/api/{generate,tags,chat}`) that bypasses
  the HAMR dispatch wrappers is intercepted at tool-call time: an `ask` plus a Tier-1
  `incidents.jsonl` event. Honors the `# hamr-bypass-ok: <reason>` carve-out; fail-open on
  any internal error (a guard bug never bricks a session).
- **tier-vocabulary validator** (`scripts/global/tier-vocabulary-validator.js`, #2739) — a
  `wrapProviderCall('ollama'|'fleet', …)` whose `tier` is absent from the canonical
  `model-routing-policy.json` vocabulary is rejected, preventing local tier-label drift.

### G4 privacy note — fleet-review data handling

Fleet/free-cloud review sends the **diff under review** to an off-box model endpoint.
Two tiers, with materially different privacy postures:

- **Local fleet** (Ollama on the Tailscale-private mesh) — the diff stays on
  operator-controlled hardware and never leaves the private mesh. This is G4-preferred.
  Caveat: "operator-controlled" is only as strong as the host — a fleet node on an
  unmanaged personal machine is weaker than a hardened server; treat the fleet host's
  trust level as part of the review's privacy boundary.
- **Free-cloud failover** (a managed third-party provider on its free tier, e.g.
  gemini-2.5-flash@google-ai-studio) — used only when the fleet host is unreachable. Here
  the diff **leaves owned infrastructure entirely** and is processed under the provider's
  terms. "Free-cloud / G3 lane" denotes zero marginal **cost**, not zero privacy cost: it
  is a real, explicit privacy step-down accepted to keep review available when the fleet is
  down (G6), never a silent default.

Treat both as egress surfaces: never dispatch a diff containing secrets or live credentials
for review. The `log-redaction.js` patterns (Anthropic/OpenAI keys, GitHub PAT, AWS, JWT,
Bearer, email, IPv4 — see `config/redaction-patterns.json`) apply to any review content
echoed into `incidents.jsonl` or baton artifacts, but redaction is a backstop, not a licence
to send sensitive diffs. The `fleet-review-required` verdict-to-diff binding (the 3-fact
anti-forgery check) is specified in #2738.

### Cross-runtime parity (deferred — AC-E6)

Claude-Code is the **reference implementation** of the fleet-review hard-gate. Codex and
Copilot runtime parity (V5 wrapper-conformance) is **deferred** and tracked via a
cross-team `TEAM_QUESTION` on #2740 — it is a cross-team sign-off request, not a client gate.
Until those teams sign off, the gate enforces on the Claude-Code surface only.
