---
name: fleet-advisor
description: Run the Fleet Advisor — audit the local fleet (F0-F4) and emit a Class A/B/C advisory report of $0 optimizations. Advisory only; never files a ticket, never auto-spends.
---

# /fleet-advisor

Audit the operator's fleet configuration and produce an **advisory** optimization report. This is the
IT-role entry point for the Fleet Advisor capability (Epic #3414). It **recommends**; it does not
perform governed work.

## What it does

1. **Layer-① lint** (`scripts/global/fleet-advisor-lint.js`) — deterministic, $0, offline-safe: probes
   the fleet, classifies tier F0→F4, evaluates the rule table (`config/fleet-advisor-rules.yml`).
2. **Layer-② AI pass** (`scripts/global/fleet-advisor-ai-pass.js`) — bounded, cross-family, $0: current
   best-practice recommendations for the detected hardware. The prompt is **hardware-only redacted**
   (engine + VRAM bucket + tier — never host addresses or secrets).
3. **IT advisory contract** (`scripts/global/fleet-advisor-report.js`) — partitions findings:
   - **Class A** · IT-actionable NOW ($0, reversible) → may run via the it-ops bypass, but ONLY with a
     durably-recorded paired rollback (atomic-or-abort: no audit ⇒ no action). No ticket, no commit.
   - **Class B** · IT-actionable, REVIEW → surfaced to the operator (optional normal-baton ticket).
   - **Class C** · CLIENT budget gate (hardware) → surfaced to the client with the cost/benefit brief
     (`research/fleet-hardware-cost-benefit-brief-3488.md`). **Never auto-spend.**

## Usage

```bash
node scripts/global/fleet-advisor-lint.js         # deterministic report (JSON)
npm run fleet-advisor:report                       # full md+json advisory report
```

## Contract

The report payload conforms to the versioned `openapi/fleet-advisor.yaml` schema — Claude Code, Codex,
Copilot, and Antigravity all import and validate it identically (cross-runtime parity, G9).

## Boundaries

- **Advisory only.** Class A never files a ticket or commit; it runs a reversible fleet-local change
  under the it-ops bypass with an enforced audit + rollback.
- **Hardware = client decision.** Class C is surfaced, never spent autonomously.
- **$0 first (G3).** The free levers (keep-warm #3484, stakes routing, Host-B repair #3486) come before
  any hardware recommendation.
