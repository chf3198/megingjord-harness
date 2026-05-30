---
name: Harness Goal Constitution
description: Priority-ordered goals (G1-G10) and decision lens for all governed work.
applyTo: "**"
---
# Harness Goal Constitution (Priority-Ordered)

G1 Governance > G2 Quality > G3 Zero Cost > G4 Privacy & Security > G5 Portability >
G6 Resilience > G7 Throughput > G8 Observability > G9 Interoperability >
G10 Maintainability.

## Definitions

- G1 Governance: policy, role, provenance, and ticket controls are non-negotiable.
- G2 Quality: correctness, testability, and engineering value are governance-enforced.
  Requires: TDD/EDD coverage floor (>=80%), functional-first design, measurable
  acceptance criteria, and passing lint/type checks before merge.
- G3 Zero Cost: prefer local/fleet/free lanes before paid providers.
- G4 Privacy & Security: sensitive context stays local unless explicit override exists;
  secrets never in git, env vars, or logs; least-privilege tokens enforced; supply-chain
  dependencies pinned; agent-consumed inputs sanitised against injection.
- G5 Portability: avoid user-specific coupling; settings-driven behavior preferred.
  Each operator has a unique baseline of local, fleet, and remote resources;
  features that require resources beyond the GitHub-access baseline (keys, secrets,
  remote services, paid plans, specific fleet hardware, preview-tier features) must
  either be classified as opt-in via env-var or label gate (parity with the existing
  MEGINGJORD_HAMR_DISABLED and IDE proxy opt-in patterns) OR ship with a documented
  minimal-resource fallback. Operator-environment variance is a first-class
  portability dimension distinct from G6: G6 covers temporary outages of normally-
  available resources, G5 covers baseline-absent resources for a given operator.
  See "Tier-graceful degradation" below for the optimal-with-fallback
  pattern that bridges G5 and G6.
- G6 Resilience: graceful degradation and fallback paths for partial outages.
  See "Tier-graceful degradation" below for the cross-cutting pattern that
  ties G5 baseline-absent and G6 transiently-unreachable into a single
  fallback path.
- G7 Throughput: coding workflow speed — CI pipeline efficiency, tool response
  time, and developer/agent velocity. Evaluated after G1–G6 are satisfied.
  Latency that is the inherent cost of satisfying a higher-priority goal (e.g.,
  fleet model wait time for G3, cross-family review time for G2) is NOT a G7
  concern — the priority order governs that trade-off. G7 violations are
  unnecessary slowdowns removable without compromising G1–G6.
- G8 Observability: decisions and outcomes are visible, auditable, and attributable.
- G9 Interoperability: preserve compatibility across agent surfaces and runtimes.
- G10 Maintainability: files <=100 lines; cyclomatic complexity <=10 per function;
  no dead code at merge; changes documented via GOV-009 EDD before implementation.

## Tier-graceful degradation (cross-cutting pattern between G5 and G6)

Every feature that can benefit from a higher-tier resource SHOULD use that
resource when available AND MUST degrade gracefully to the lowest available
tier when the higher resource is absent or unreachable.

- "Available" is determined by environment (G5): the operator's asserted
  minimum tier (env var MEGINGJORD_MINIMUM_TIER specified in the future
  Epic-tracked tier-portability work, currently Epic #2398) defines the
  highest tier the implementation may assume. Until that env var ships,
  the rule is interpreted from the operator's documented baseline.
- "Unreachable" is determined by runtime (G6): network outage, rate-limit,
  authentication failure, or any other transient condition.
- The two are distinct: G5 absent means "this operator never has the resource";
  G6 unreachable means "the resource is normally present but currently down."
  Both lead to the same fallback path.

Cross-runtime applicability: the pattern is runtime-agnostic. It applies
uniformly to Claude Code, Codex, Copilot, and Antigravity runtimes (and any
future entrants verified via the cross-orchestrator compatibility suite
tests/orchestrator-compatibility.spec.js shipped in #2388). Runtime-specific
tier assertions (e.g., a fleet-only feature for OpenClaw) carry their own
MINIMUM_TIER and per-runtime fallback design but the optimal-with-fallback
discipline holds identically.

Reference implementation: scripts/global/mailbox-client.js MAY post to HAMR R2
when MEGINGJORD_HAMR_DISABLED is unset and the worker is reachable, falling
back to .gnap/messages/<team>/<timestamp>.json committed to the issue branch
when either condition fails. The fallback IS the default; the optimization
IS the upgrade.

Engineering practice: when introducing a feature that uses a tier-2-or-higher
resource, the same PR must ship the tier-1 fallback. Single-tier dependencies
on resources above the operator's asserted minimum are rejected at code review
as G5 violations. CI enforcement (a megalint validator that scans PR diffs for
tier-2-or-higher dependencies without tier-1 fallback) is tracked as a follow-on
under Epic #2398 AC3 (per-script tier audit + frontmatter tags); until that
validator ships, the rule is reviewer-enforced.

## Decision Lens (lightweight, required)

For any design/routing/tooling decision, briefly verify in this order:
1) Is it governance-compliant? 2) Does it improve or preserve quality?
3) Can it run at zero cost first? 4) Is privacy and security preserved by default?
5) Is it portable across operator baselines (will it work for an operator without
   resource X)? 6) Is degradation safe? 7) Is it fast enough?
8) Is it observable? 9) Does it remain interoperable? 10) Is it maintainable?
