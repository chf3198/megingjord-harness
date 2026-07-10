---
title: "AC-R6 — Retrieval quality + memory eval harness (LongMemEval/LoCoMo/FAMA style)"
ticket: 3725
epic: 3724
lane: docs-research
ac: AC-R6
last_updated: 2026-07-10
status: ratified
cross_family_receipt: 6ff89cae609cfb1b
related:
  - "[[mem-surface-inventory-3725]]"
  - "[[mem-ac-r2-temporal-3725]]"
  - "[[mem-ac-r4-context-budget-3725]]"
---

# AC-R6 — Retrieval quality + evaluation

## Question
Adopt a LongMemEval/LoCoMo/BEAM-style eval harness for the memory system (retrieval + update + selective-forgetting), reusing the existing replay-eval infra where possible.

## As-is
The wiki has a **drift replay-eval** (advisory→required gated on precision ≥0.85, not calendar) and `read-router.js` (index-first + grep floor; embeddings/graph **DEFERRED**, replay-eval-gated; `recallMiss()` G8 canary). There is **no memory-specific** retrieval + update + forgetting eval — the exact gap this AC closes.

## SOTA evidence
- **LongMemEval** (arXiv **2410.10813**): 500 Qs, 5 abilities (info-extraction, multi-session, temporal, knowledge-update, **abstention** `_abs`); `_S` ~115K tokens. Headline: long-context LLMs drop **30–60%** vs oracle. **LongMemEval-V2** (arXiv **2605.12493**) pivots to web-agent trajectories (up to 115M tokens).
- **LoCoMo** (arXiv **2402.17753**): 50 multi-session dialogues, 1,540 QA (single/multi-hop, temporal, open-domain); critique — no explicit knowledge-update scoring.
- **BEAM** (arXiv **2510.27246**): 100 convs at 128K–10M tokens, 10 abilities incl. **contradiction resolution**; even 1M-context LLMs degrade with length.
- **"From Recall to Forgetting"** (arXiv **2604.20006**): **FAMA** metric — each Q paired with *memory-presence* AND *forgetting-absence* criteria; presence-only metrics **overestimate** quality. Retrieval competence ≠ temporal competence.
- **Retrieval quality:** hybrid (BM25 ⊕ dense ⊕ graph ⊕ metadata) beats either leg — **retrieval failure is the dominant error (11–46% of Qs)**; a reranker roughly **halves failures** (Basic RAG 35.3%→11.4%); BM25-only is the weak leg (~57%), so a keyword store's blind spot is **synonymy/paraphrase**.

## Decision (recommended)
Build a **file-native memory eval harness** reusing the replay-eval infra — **no vector DB needed** (the benchmarks score answer correctness against a fixed history, they are retrieval-agnostic):

1. **Eval item schema** (LongMemEval ⊕ FAMA): `{question, expected_page(s)/anchor, expected_fact, gold_answer, type ∈ {extraction, multi-session, temporal, knowledge-update, abstention, forgetting-absence}, history_commits}`.
2. **Score three layers separately:** (a) **retrieval** — did the router surface the correct page/anchor? `Recall@k` / `MRR` vs `expected_page`; (b) **answer** — LLM-judge ($0 fleet/local) vs `gold_answer`; (c) **update/forgetting** — **FAMA dual criteria**: checkpoint the repo at commit N, ask the update question, assert the router returns the **current** page AND the answer **excludes** the superseded fact (which still exists in git history) — directly tests AC-R2's close-don't-overwrite + the "knowledge-update" ability LoCoMo lacks.
3. **Abstention items** (`_abs`): ask about never-committed facts → correct = router returns nothing + model declines (cheap in a git store).
4. **Over-weight the keyword blind spot:** seed synonymy/paraphrase cases; compensate with frontmatter **alias/tag** fields + query expansion (**not** embeddings) — keeps the index-first $0 floor.
5. **Scale:** 100–500 items (LongMemEval_S ~115K tokens is a realistic committed-markdown corpus). BEAM-10M is aspirational, out of Phase-0 scope.
6. **Promotion:** advisory → required gated on **precision ≥0.85** vs the labeled corpus (the harness's existing replay-eval pattern, never calendar).

## Tradeoffs / non-goals
- **G3/G2:** $0 (git checkpoints + local LLM judge); reuses replay-eval infra. Non-goal: embeddings/graph retrieval (stays DEFERRED behind this very eval — the eval is what would *justify* promoting them if the keyword floor underperforms).

## PANEL SUMMARY
"Build a file-native memory eval harness (100–500 items) reusing the existing replay-eval infra with LongMemEval⊕FAMA item schema, scoring THREE layers separately — retrieval (Recall@k/MRR vs expected page), answer (local $0 LLM-judge vs gold), and update/forgetting (FAMA dual criteria: git-checkpoint at commit N, assert the current page is returned AND the superseded fact is excluded) — plus abstention items for never-committed facts; over-weight the keyword synonymy/paraphrase blind spot and compensate with alias/tag frontmatter + query expansion (no embeddings, index-first floor preserved); promote advisory→required on precision ≥0.85 vs the labeled corpus (never calendar). Sound and safe?"

## Decision log (G8)
- 2026-07-10 — Recommend a $0 file-native LongMemEval⊕FAMA harness reusing replay-eval; 3-layer scoring incl. forgetting-absence. Reversible. Cross-family panel: receipt above / #3725 comment.
