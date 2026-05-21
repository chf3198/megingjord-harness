# Deliverable 6b — Iteration-2 Red-team Classification

Phase-0 ticket: #2038. Iter 2 of N.

## Iter-2 verdict summary

| Section | Verdict | Detail |
|---|---|---|
| A — Rejections | Red-team **ACCEPTED all 3** | localization, hallucinated URLs, cross-LLM duplicate |
| B — Score disagreements | **G2, G6, G8, G10** flagged for "specify how" | Generic specificity critiques — partially valid |
| C — New attack surfaces | **2 new attacks** | template-code-injection (Markdown XSS), config-file manipulation |
| D — A+ verdict | **NOT-YET-A+** | 4 outstanding integration items |
| E — Citation-validation | **AGREED** | Forwarded to Epic #2041 with concrete protocol step |

## Section B disagreement analysis

| Goal | Red-team concern | Verdict | Plan v3 action |
|---|---|---|---|
| G2 | "does not specify how anomaly detection + adversarial fuzz integrate into pipeline" | PARTIAL-ACCEPT | Add integration-points subsection to C5 spec |
| G6 | "does not specify what constitutes 'persistent LLM-bridge failure'" | ACCEPT | Define threshold concretely: 3 consecutive schema-validation failures within a single build attempt |
| G8 | "no mention of how decisions are made visible/auditable/attributable beyond compliance log" | PARTIAL-ACCEPT | Add: dashboard panel + operator-review-mode attribution flag + signer-alias canonicalization preserved |
| G10 | "no evidence components adhere to size/readability limits" | ACCEPT | Add per-child line-count budget table; cite `lint-readability.js` enforcement |

## Section C new attack surfaces

### Attack 1 — Template-injection of executable code (Markdown XSS path)

- Mustache itself is logic-less, so no JS executes in the template engine. BUT: rendered output is posted as Markdown on GitHub; GitHub's renderer permits inline HTML (`<img onerror=...>`, embedded `<script>` historically). User-supplied prose in `rationale`/`scope`/`synthesis_narrative` slots could carry HTML.
- Mitigation (Plan v3 C10 expansion): all string template fills are HTML-escaped before render; schema patterns reject `<script>` / `javascript:` / `onerror=` / `onload=` patterns in any string field.

### Attack 2 — Configuration file manipulation

- Plan v2 fixture-integrity covers schemas + templates. But the builder also reads `inventory/team-model-signatures.json` (for signer derivation) and `scripts/global/model-routing-policy.json` (for tier routing in C6). Mutation of these could re-attribute baton artifacts to wrong signer or downgrade Premium routing.
- Mitigation (Plan v3 C10 expansion): SHA-256 fixture-integrity gate extended to all builder-input config files (signatures, routing policy).

## Forward to Plan v3

`programmatic-workflow-plan-v3-2026-05.md` will incorporate:

1. C5 G2 integration-points subsection
2. C6 G6 concrete "persistent failure" threshold + degradation chain
3. C9 G8 dashboard + attribution flag spec
4. Per-child G10 line-count budget table
5. C10 expansion: HTML-escape + JS-pattern rejection in all string slots
6. C10 expansion: config-file fixture-integrity for signatures + routing policy

Then submit to iteration 3.

## Citation-validation meta-finding — protocol step text (forwarded to Epic #2041)

Red-team's proposed step: "Implement a DOI validation service that checks the existence of provided arXiv URLs before they are accepted as valid citations in the system."

Refined for Epic #2041:
- All red-team-supplied URLs MUST be fetched (HTTP HEAD or GET) before incorporation into the primary's research corpus
- HTTP 200 response is necessary but not sufficient; the title/abstract MUST match the asserted claim within an edit-distance threshold (≤30% diff vs the red-team's summary of the citation)
- Citations failing fetch OR match are marked HALLUCINATED in the iteration's classification doc; the primary does NOT incorporate them and the red-team is flagged for citation-fidelity training

This becomes a Phase-0 R&D input to #2041 once that Epic moves out of backlog.

## References

- Iter-1 classification: `redteam-classification-2038-iter1-2026-05.md`
- Plan v2: `programmatic-workflow-plan-v2-2026-05.md`
- Raw iter-2 response: `/tmp/rt2038-iter2-text.md` (will archive at ship time)
