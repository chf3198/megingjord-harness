# Ticket 131 — OpenClaw Reliability Research + Wiki Evolution

Priority: P1 (High)
Type: Research
Area: infra
Status: ready
Parent: #128

## Manager Scope

Objective:
- Run targeted web research on current OpenClaw/LiteLLM/Ollama reliability patterns and update wiki knowledge accordingly.

Required Research Inputs:
1. LiteLLM routing/reliability (fallbacks, retries, cooldowns).
2. OpenClaw gateway exposure and operational safety patterns.
3. Local inference alternatives (`llama.cpp`, LocalAI, vLLM) for comparative decisions.

Acceptance Criteria:
1. Research page includes summary table, source links, and actionable next steps.
2. Wiki pages updated where drift exists (`entities`, `concepts`, `sources`, `index`, `log`).
3. Recommendations are explicit about what is IT-only vs harness-coupled.

## MANAGER_HANDOFF

- Status transition: `triage -> ready`
- Ready for collaborator research + documentation updates.

## BLOCKER_NOTE

- owner: collaborator (LLM reliability research)
- unblock_condition: #128 epic infrastructure settled; OpenClaw gateway patterns documented; local-inference alternatives matured
- eta_or_review_time: manager review by 2026-05-07 governance queue