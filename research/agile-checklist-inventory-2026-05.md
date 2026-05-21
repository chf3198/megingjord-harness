# Deliverable 1 — Agile-role-checklist task inventory (2026-05-21)

Phase-0 ticket: #2038. Parent Epic: #2037.

Catalog every Agile-role-workflow task currently performed by AI models across Claude Code, Copilot, and Codex runtimes. Classification: **PROGRAMMATIC** (template-rendered or deterministic logic) / **LLM-GENERATED** (model-authored prose each invocation) / **HYBRID** (deterministic structure + LLM-filled slots).

## Baton-handoff artifacts (the bulk of LLM-generation today)

| Task | Trigger | Current impl | Input data | Output schema | Observed variability |
|---|---|---|---|---|---|
| **MANAGER_HANDOFF** comment | After Manager scope finalized | **LLM-generated** (sometimes uses `baton-comment-build.js` as starter, but ACs/scope/gates filled by LLM each time) | scope, lane, test_strategy, gates, acceptance, anneal_tier, phase_gate_satisfied, phase_0_sources, signer | Markdown comment with `## MANAGER_HANDOFF` header + structured fields | Inconsistent field ordering; missing fields (validators fire `missing-gates`, `missing-acceptance`); prose mentions of OTHER artifact names trip prose-collision validator |
| **COLLABORATOR_HANDOFF** comment | After Collaborator implementation | **LLM-generated** | per-AC verification summary, lint result, test count, signer | Markdown comment with `## COLLABORATOR_HANDOFF` header + structured fields | Per-AC narrative varies wildly in length; flaw-recognition section sometimes missing citation; sometimes missing test_strategy field |
| **ADMIN_HANDOFF** comment | After Admin gate verification | **LLM-generated** | branch name, commit hash, signer-independence check, deploy-runtime impact, signer | Markdown comment with `## ADMIN_HANDOFF` header | Inconsistent before/after evidence formatting; cross-artifact prose mentions (Reyes vs Harper, etc.) trip signer-alias-fidelity |
| **CONSULTANT_CLOSEOUT** comment | After Consultant rubric | **HYBRID** (rubric-score.js IS deterministic; closeout assembly is LLM) | rubric scores per G1-G10, verdict, verification timestamp, anneal_tickets_filed, mid_flight_flaws, signer | Markdown comment with `## CONSULTANT_CLOSEOUT` header | Rubric scores reliable; closeout-assembly format drifts; `rubric_version` field sometimes missing the v3 marker |
| **CONSULTANT_EPIC_CLOSEOUT** comment | Epic terminal close | **LLM-generated** | per-child completion table, Epic-level rubric, anneal tickets, mid-flight flaws | Markdown comment | Highest variability — Epic-level synthesis is hardest to template; rich narrative required |
| **TEAM_QUESTION** / **TEAM_RESPONSE** comments | Cross-team artifact-write coordination | **LLM-generated** | target team, schema source, sign-off status | Markdown comment | Used rarely; observed in 1 ticket (#1917) — no reliable cross-runtime parity |
| **EPIC_RESCOPE** comment | Manager re-scope mid-Epic | **LLM-generated** | scope delta, deferred items, child-ticket plan | Markdown comment | Rare; high-variability |
| **EPIC_AMENDMENT** comment | Mid-flight pivot | **LLM-generated** | findings rationale, scope changes, anneal decision | Markdown comment | Rare; observed in Epic #1962 red-team response (mine) |
| **BLOCKER_NOTE** comment | P0/P1 ticket ready >24h | **LLM-generated** | owner, unblock condition, ETA | Markdown comment | Per memory `feedback_*_blocker_*` — required fields enforced by validator but assembly is LLM |
| **EPIC_AUTO_PAUSE** comment | Auto-transition triggers | **PROGRAMMATIC** | activity window data | Markdown comment with implicit resume trigger | Consistent (workflow-driven) |
| **EPIC_PHASE_GATE_PAUSE** comment | Phase-0 child reopens | **PROGRAMMATIC** | re-arm trigger details | Markdown comment | Consistent |

## Git-layer artifacts

| Task | Current impl | Input data | Output schema | Variability |
|---|---|---|---|---|
| Commit message subject | **LLM-generated** | change summary, ticket # | Conventional Commit format: `type(scope): description #N` | Title length 50-72 chars; type prefix correctness varies (`research(...)` not allowed; should be `docs(...)`); ticket # placement varies |
| Commit message body | **LLM-generated** | implementation summary, signing trailers | Multi-paragraph body + 3-line signing trailer block | Variable depth; signing trailers sometimes malformed |
| Commit signing trailers | **PROGRAMMATIC** (via `agent-signature.js`) | team, model, role | `AI-Signature: <alias>` + `AI-Team-Model: ...` + `AI-Role: ...` | Consistent when builder used; **inconsistent when LLM constructs them manually** (signer-alias-invention failures) |
| Branch naming | **HYBRID** (constraint + LLM-chosen slug) | type prefix, ticket #, slug | `<type>/<N>-<slug>` | Type prefix correctness varies (refactor/test/docs/perf rejected; only feat/fix/hotfix/chore/skill allowed) |
| PR title | **LLM-generated** | type, scope, summary, ticket # | Conventional Commit ≤60 char subject | ≤60-char cap regularly violated; type-prefix mis-selection (`research(...)`) |
| PR body | **LLM-generated** | Refs/Closes, summary, verification, baton-artifact references | Markdown with `Refs #N` first, `Closes #N` for auto-close, baton-artifact section, lane + test_strategy | `Refs` ordering frequently wrong (Refs Epic before Refs child); Closes/Refs both needed for separate gates (memory `feedback_refs_ordering_in_pr_body`) |
| CHANGELOG fragment | **LLM-generated** | ticket #, change summary, references | Per-ticket file at `.changes/unreleased/<N>.md` | Format drift across runtimes |

## Label transitions

| Task | Current impl | Variability |
|---|---|---|
| `status:*` label transitions | **PROGRAMMATIC** (`gh issue edit --add-label / --remove-label`) | Consistent when operator follows protocol; failure mode is forgetting to remove old label |
| `role:*` label transitions | **PROGRAMMATIC** | Same pattern |
| `resolution:*` label application on close | **PROGRAMMATIC** | Consistent |
| Issue close + status:done atomicity | **PROGRAMMATIC** (`gh issue close --reason completed`) | Sometimes not atomic with label flip (separate commands) |

## CI / governance gate enforcement

| Task | Current impl | Variability |
|---|---|---|
| Lint (`npm run lint`) | **PROGRAMMATIC** | Deterministic |
| Readability gate | **PROGRAMMATIC** (`scripts/lint-readability.js --max-warnings=460`) | Deterministic |
| Megalint validators (closeout-schema, manager-handoff, evidence-completeness, etc.) | **PROGRAMMATIC** | Deterministic — these are the WALL the LLM-generated artifacts hit |
| Rubric scoring (`rubric-score.js`) | **PROGRAMMATIC** (v3 since #1967) | Deterministic |
| OWASP coverage audit (#1987) | **PROGRAMMATIC** | Deterministic |
| Fixture integrity (#2027) | **PROGRAMMATIC** (SHA-256) | Deterministic |
| OTel content validation (#2028) | **PROGRAMMATIC** | Deterministic |
| Per-goal coverage audit gate (#1973) | **PROGRAMMATIC** | Deterministic |
| PDCA artifact emission (#1974) | **PROGRAMMATIC** | Deterministic |

## State + ops bookkeeping

| Task | Current impl | Variability |
|---|---|---|
| `admin_ops` flag updates (commit/push/pr_create/ci_green/merge) | **PROGRAMMATIC** (via hooks) | Inconsistent — flags don't always update on direct `git` calls (per #1975 state-persistence gap) |
| `flags.code_touched` | **PROGRAMMATIC** | False-positives observed (per #1960) |
| `incidents.jsonl` emission | **PROGRAMMATIC** (v3 schema) | Consistent |
| `cache-stats.jsonl` emission | **PROGRAMMATIC** (HAMR wrapper) | Consistent when wrapper used; bypass-able (per #2029) |
| Anneal decision | **HYBRID** (LLM identifies flaw; protocol routes to Tier-1/2/3 via deterministic classifier) | Inconsistent — LLM-flavored decision wording trips validators |

## Aggregate stats

| Category | Programmatic | LLM-generated | Hybrid | Total |
|---|---|---|---|---|
| Baton handoffs | 2 (auto-pause / phase-gate-pause) | 8 | 1 (CONSULTANT_CLOSEOUT) | 11 |
| Git artifacts | 1 (signing trailers) | 5 | 1 (branch name) | 7 |
| Label transitions | 4 | 0 | 0 | 4 |
| CI gates | 9 | 0 | 0 | 9 |
| State bookkeeping | 4 | 0 | 1 (anneal decision) | 5 |
| **Total** | **20** | **13** | **3** | **36** |

## Observed cross-model variability (from this codebase's incident history)

Real failure cases observed:

1. **Signer-alias invention** — memory `feedback_signer_alias_derivation` documents 40+ artifacts in a single session with invented aliases (Cole/Mira/Yara) not in inventory. Smaller models hallucinate plausible names.
2. **PR title >60 chars** — memory `feedback_pr_title_length` documents repeated `pr-title-required` CI failures. LLM doesn't reliably count characters.
3. **Branch-prefix mis-selection** — memory `feedback_branch_name_prefix` documents `refactor/...` / `test/...` / `docs/...` branches getting rejected because the prefix allowlist is feat/fix/hotfix/chore/skill only.
4. **Refs/Closes ordering** — memory `feedback_refs_ordering_in_pr_body` documents validators failing when `Refs Epic #N` appears before `Refs #child-N`.
5. **Team&Model substrate** — memory `feedback_team_model_prose_collision` documents `@anthropic` vs `@local` confusion; cross-artifact prose mentions trip signer-alias-fidelity.
6. **Role colon prose collision** — memory `feedback_role_colon_prose_collision` documents `role:NAME` prose substitution failures.
7. **Flaw-emission per-line citation** — memory `feedback_flaw_emission_per_line_citation` documents multi-flaw bulleted lists with citation only on the trailing line failing the validator.
8. **`research(...)` type prefix** — observed in PR #2036 this session; not in conventional-commits allowlist (correct = `docs(...)`).

Every one of these failures has a **deterministic-template fix** — generating the artifact from structured input + a template would catch (1)–(8) at build time, never letting the malformed artifact reach the validator.

## What CAN'T be templated (preview of Deliverable 5 counter-argument)

- **AC verification narrative** — "AC1 PASSED — 6 of 6 surfaces include G10" is structured, but the rationale ("the wiki page was edited per #1530 D-1526-03 with 3 specific insertion points...") is LLM-flavored.
- **Per-flaw `mid_flight_flaws` rationale** — judgment about whether a flaw warrants ticket vs incident-only is a model decision.
- **EPIC_RESCOPE prose** — re-scoping requires context the template can't synthesize.
- **Adversarial red-team response narrative** — interpreting findings + classifying accept/reject/partial is judgment work.

These are the irreducible LLM-intervention surfaces. The pattern: **deterministic structure + LLM fills only the narrative slot.**

## Conclusion

Of 36 distinct Agile-role-checklist tasks: 20 are already programmatic, 3 hybrid, 13 LLM-generated. Of the 13 LLM-generated, **at least 10** are 100% template-renderable from structured input. The remaining 3 (Epic closeout synthesis, cross-team coordination prose, red-team response narrative) require LLM intervention but can be wrapped in a structured shell.

Phase-1 candidate scope (preview; finalized in Deliverable 4): convert all 10 fully-templatable LLM-generated tasks to programmatic, and define structured-input + LLM-slot pattern for the 3 irreducible cases.

## References

- Memory anchors: `feedback_signer_alias_derivation`, `feedback_pr_title_length`, `feedback_branch_name_prefix`, `feedback_refs_ordering_in_pr_body`, `feedback_team_model_prose_collision`, `feedback_role_colon_prose_collision`, `feedback_flaw_emission_per_line_citation`
- Existing programmatic builder: `scripts/global/baton-comment-build.js`
- Existing signer registry: `scripts/global/agent-signature.js` + `inventory/team-model-signatures.json`
- Existing rubric scorer: `scripts/global/rubric-score.js` (#1967 v3)
- Related: Epic #2037 (this Epic) + Phase-0 #2038 (this ticket)
