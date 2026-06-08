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

Fleet/free-cloud review sends the **diff under review** to an off-box model endpoint
(local Ollama on the Tailscale mesh, or a free-cloud provider such as
gemini-2.5-flash@google-ai-studio when the fleet host is unreachable — the G3 lane). Treat
this as an egress surface: never dispatch a diff that contains secrets or live credentials
for review. The `log-redaction.js` patterns apply to any review content echoed into
`incidents.jsonl` or baton artifacts. Local fleet (Tailscale-private) keeps the diff on
owned infrastructure (G4-preferred); the free-cloud failover trades a marginal privacy
surface for G3 zero-cost when the fleet is down — an explicit, documented degradation, not
a silent one.

### Cross-runtime parity (deferred — AC-E6)

Claude-Code is the **reference implementation** of the fleet-review hard-gate. Codex and
Copilot runtime parity (V5 wrapper-conformance) is **deferred** and tracked via a
cross-team `TEAM_QUESTION` on #2740 — it is a cross-team sign-off request, not a client gate.
Until those teams sign off, the gate enforces on the Claude-Code surface only.
