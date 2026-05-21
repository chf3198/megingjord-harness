# Deliverable 6 — Iteration-1 Red-team Classification

Phase-0 ticket: #2038. Parent Epic: #2037.
Guest collaborator: qwen2.5-coder:32b @ fleet (Tailscale 100.91.113.16:11434).
Primary collaborator: claude-code:opus-4-7.
Iteration: 1 of N (until A+ agreement).

## Methodology

Plan v1 + Deliverables 1-3 + 5 submitted to qwen2.5-coder:32b with explicit harness G1-G10 labels (correcting #1962 red-team's NIST/OECD substitution failure where the fleet model substituted unrelated rating frameworks). Prompt requested 6 sections: structural critique, research depth, thesis critique, per-goal re-rating using actual harness labels, A+ verdict, 3 adversarial attacks.

## Findings classification

### ACCEPT — incorporated into Plan v2

| # | Finding | Goal impact | Plan v2 location |
|---|---|---|---|
| RT1 | C5 anomaly detection in historical replay corpus | G2↑ G8↑ | C5 expansion |
| RT2 | C6 explicit Premium-fallback condition | G3 8→9 | C6 expansion (also v1-self-id) |
| RT3 | C6 operator-review-mode for persistent failures | G6 8→9 | C6 expansion (also v1-self-id) |
| RT4 | C7 per-call latency budget documentation | G7 8→9 | C7 expansion (also v1-self-id) |
| RT5 | C8 rollback strategy on migration failure | G6↑ | C8 expansion |
| RT6 | C9 compliance logging via `baton-builds.jsonl` | G8↑ | C9 expansion |
| RT7 | Schema-injection attack defense (SHA-256 schema integrity) | G1↑ G4↑ | new C10 |
| RT8 | Template-manipulation attack defense (SHA-256 template integrity) | G1↑ G4↑ | new C10 |
| RT9 | JSON-data-corruption attack defense (adversarial fuzz corpus) | G2↑ G6↑ | C5 expansion |

### REJECT — with rationale

| # | Finding | Rejection rationale |
|---|---|---|
| RT-R1 | Hypothetical arxiv URLs (2605.12345, 2603.54321, 2607.89102, 2608.12345, 2609.12345) | Hallucinated DOI placeholders. None match real papers. Same failure class as #1962 red-team's NIST/OECD substitution. Meta-finding: Epic #2041 must add citation-validation step. |
| RT-R2 | C2 localization / i18n support | Conflates "portability" semantics. Harness G5 is about runtime portability (CC/Copilot/Codex/air-gapped) NOT human-language i18n. Baton artifacts are English-only GitHub governance comments. Out of scope. |
| RT-R3 | C7 child task for cross-LLM consistency | Duplicates C6's existing cross-provider testing (Anthropic + OpenAI + Ollama-via-fleet ≥95% schema-valid). |

### PARTIAL — incorporated with modification

| # | Finding | Modification |
|---|---|---|
| RT-P1 | "8.7 mean does not fully account for areas needing improvement" | Partially accept: Plan v1 self-eval was honest about G3/G6/G7 at 8. Red-team correctly flags that even goals at 9 (G2) have specific add-on opportunities (anomaly detection). Plan v2 lifts G2 to 10 via anomaly detection + adversarial fuzz. |

## Meta-finding (forwarded to Epic #2041)

Fleet model qwen2.5-coder:32b produced **5 hallucinated arxiv URLs** in the research-depth section. This is the second observed instance (first: #1962 red-team's NIST/OECD substitution). The pattern: smaller cross-family models confabulate plausible-looking citations when asked for "recent research."

**Required addition to Epic #2041 protocol design**: a citation-validation step where every red-team-supplied URL is fetched + checksum-compared against the asserted abstract/title before being accepted into the primary's research corpus. Forwarded as a Phase-0 R&D input to #2041.

## Adversarial attacks accepted as design constraints

RT7 + RT8 + RT9 are not "findings to incorporate" — they are **attack surfaces to defend**. New child C10 (Schema + template fixture-integrity gate) added to Plan v2 to defend RT7/RT8. C5 expanded with adversarial-input fuzz corpus to defend RT9.

## A+ agreement status after iteration 1

Not yet. Red-team's verdict: "Plan v2 should be accepted at A+ if the following conditions are met" — i.e., red-team is willing to grant A+ once accepted findings ship. Plan v2 will incorporate them and be submitted for iteration 2.

## References

- Plan v1: `programmatic-workflow-plan-2026-05.md`
- Red-team raw response: `/tmp/rt2038-text.md` (will be archived to `research/redteam-raw-2038-iter1.md` at ship time)
- Counter-argument: `programmatic-vs-llm-counter-argument-2026-05.md`
- Meta-finding source: #1962 red-team session, this session
