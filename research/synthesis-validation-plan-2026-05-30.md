---
title: Cross-team R&D synthesis validation plan (Phase-6 #2407)
date: 2026-05-30
lane: docs-research
source_tickets: [1112, 2407]
signers:
  manager: Orla Mason (claude-code:opus-4-7@local)
  collaborator: Orla Harper (claude-code:opus-4-7@local)
  consultant: Orla Vale (claude-code:opus-4-7@local)
---

# Phase-6 #2407 — Cross-team R&D synthesis validation plan

Per Epic #1112 AC8: "validation against ≥1 new Epic (eval-harness)". This Phase-1 child is intentionally a PLAN deliverable because a real validation run requires actual multi-team session coordination (Claude Code + Codex + Copilot + Antigravity); single-team simulation would invalidate the empirical signal.

## 1. Validation target candidate

**Epic #2398** (harness resource-tier portability) is the recommended first real-run target:

- Well-scoped (10 ACs, clear deliverables)
- No in-flight contamination (only Phase-0 #2412 closed; Phase-1 children not yet filed)
- Benefits from cross-team perspectives:
  - Antigravity Team: per-runtime tier sensitivity (Antigravity sessions may have different cost profiles)
  - Codex Team: Codex CLI vs Codex VS Code substrate tier differences
  - Copilot Team: GitHub-native vs cloud-managed tier mapping
  - Claude Code Team: HAMR + Cloudflare integration tier classifications

## 2. Pre-run checklist

1. Operator confirms ≥3 AI agent teams available + responsive
2. Run `npm run synthesis:init -- --epic 2398` to scaffold planning/synthesis-2398/
3. Verify all team aliases derive from `inventory/team-model-signatures.json` per #2370 validator
4. Confirm Tier-1 baseline operational (GitHub Actions cron + .gnap/dispatch/ git-board)

## 3. Success criteria (per Epic #2399 + protocol v3 §13)

- All teams produce Phase-R artifacts within 1h wave-cap
- Phase-D converges within 24h hard ceiling OR K-S adaptive (p < 0.05 across 3 consecutive waves)
- Consultant rubric per goal-lens ≥7 across G1-G9 (Epic governance clause 1)
- No #2370 cross-team-response-fidelity violations
- Phase-C closeout per v3 §9 lead-team baton

## 4. Eval-harness measurements

For each synthesis run, capture (writes to `.dashboard/synthesis-eval-<rdN>.json`):

| Metric | Source | Healthy range |
|---|---|---|
| total_wall_clock_hours | pulse.json + close timestamp | 4-24h |
| wave_count | stability.json.wave_p_values.length | 3-8 |
| final_decision_count | decisions.md count | 5-20 |
| websearch_citations_per_team | artifacts/*-rd.md grep | ≥5 per team |
| repo_anchors_per_team | artifacts/*-rd.md grep | ≥10 per team |
| reject_rate | decisions.md state distribution | <30% |
| unanimous_concur_rate | decisions.md final state | >70% |
| signer_fidelity_violations | #2370 validator output | 0 |

## 5. Failure modes (from #1131 + protocol v2 §0)

1. Substrate-vs-model identity collision → caught by #2370 validator
2. Concurrent-write across shared workspace → mitigated by file ownership in v3 §6
3. Decision-numbering collisions → admin allocator in v3 §7
4. Zero websearch citations → enforced by v3 §4
5. Zero cross-team challenge → wave dispatch enforces in v3 §5
6. Inactive admin → WAVE_SUMMARY schema enforces in v3 §8
7. Missing baton handoff → enforced by lane:code-change baton-gates

If validation run hits any of these, capture as #2407 AC8 evidence + file follow-on against v3 spec.

## 6. Open questions to resolve via validation run

- Is 24h hard ceiling actually appropriate? #2396 baseline is single #1105 point (6.5h)
- Does K-S adaptive correctly detect false stability at small decision counts?
- Does the GNAP-board overlay (#2395) get triggered or stay opt-in?
- Does the dispatcher hybrid (#2393) actually reduce operator wall-clock vs all-operator-paste?

## 7. Validation execution log

(Empty until first real run. To be populated by operator + admin team after #2398 synthesis kickoff.)

| Run | Date | Epic | Lead team | Admin team | Outcome | Lessons captured |
|---|---|---|---|---|---|---|
| N/A | — | — | — | — | (pending) | — |

## 8. Acceptance for ticket close

Phase-6 #2407 closes when EITHER:
- A real validation run executes and the eval-harness JSON is committed; OR
- This plan document is accepted as a deliverable + a follow-on ticket files the actual run

Recommended: close this plan ticket; file follow-on `feat(governance): execute first protocol-v3 validation synthesis on #2398` to track the actual run separately.

Refs Epic #1112 · Refs v3 §13 · Refs #2370 #2396 #2398
