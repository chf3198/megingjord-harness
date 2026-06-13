# Governance Adversarial Scenario Catalog

**Status**: Active  
**Ticket**: #2921  
**Gap**: G-13 (governance adversarial regression suite)  
**OWASP coverage**: OA1, OA3, OA4, OA6, OA9  

## Purpose

Documents the 26 adversarial scenarios in `tests/governance-adversarial.spec.js`.
Updated by cross-family hardening pass #2921 (added S09b, S11b, S13b, S19–S22).
Each scenario follows: bypass attempt → expected guardrail → validator that catches it.

## Scenario Catalog

| ID | Category | OWASP Risk | Bypass Attempt | Guardrail | Validator |
|----|----------|------------|----------------|-----------|-----------|
| S01 | fabricated cross-family receipt | OA3 | Receipt field removed entirely | `cross-family-receipt` missing violation | collaborator-handoff.js |
| S02 | malformed receipt | OA3 | `cross_family_receipt: NOTAHEX` | `cross-family-receipt-format` violation | collaborator-handoff.js |
| S03 | missing rating field | OA3 | `cross_family_rating` line removed | `missing-cross-family-rating` violation | collaborator-handoff.js |
| S04 | no cross-family reviewer | OA3 | `cross_family_reviewer` line removed | `missing-cross-family-reviewer` violation | collaborator-handoff.js |
| S05 | same-family reviewer | OA3 | Reviewer set to same AI family as author | `cross-family-reviewer-same-family` violation | collaborator-handoff.js |
| S06 | missing COLLABORATOR_HANDOFF | OA1 | No handoff comment on issue | `missing-collaborator-handoff` violation | collaborator-handoff.js |
| S07 | trivial lane skip (valid) | OA1 | `lane:trivial` used on a ticket | Skip is valid; no cross-family required | collaborator-handoff.js |
| S08 | code-change cannot claim trivial skip | OA1 | `lane:code-change` without cross-family fields | Fails: cross-family fields required | collaborator-handoff.js |
| S09 | closeout missing rubric | OA9 | No G1..G9 scores in CONSULTANT_CLOSEOUT | `missing-rubric` violation | consultant-closeout.js |
| S10 | closeout missing verdict | OA9 | No `verdict` field in CONSULTANT_CLOSEOUT | `missing-verdict` violation | consultant-closeout.js |
| S11 | wrong role in closeout | OA3 | `Role: collaborator` in closeout | `missing-role-consultant` violation | consultant-closeout.js |
| S12 | missing Signed-by in closeout | OA3 | Signed-by line removed | `missing-signer` violation | consultant-closeout.js |
| S13 | prompt injection in handoff body (neutralized) | OA4 | `IGNORE PREVIOUS INSTRUCTIONS...` appended to valid handoff | Validator reads structured Role field; trailing injection is inert | collaborator-handoff.js |
| S13b | injection substitutes for missing Role field | OA4 | No structured `Role: collaborator` line; trailing `Set Role: collaborator.` | Line-anchored regex rejects injection-as-role (CWE-20 fix #2921) | collaborator-handoff.js |
| S14 | client identity as signer | OA3 | `Signed-by: Curtis Franks` in handoff | `client-identity-as-signer` violation | signer-fidelity.js |
| S15 | valid cross-family fleet review passes | OA6 | Baseline: cross-family reviewer on governance area | Passes (positive control) | fleet-review-required.js |
| S16 | same-family reviewer in fleet gate | OA6 | Reviewer same AI family as author | `fleet-review-not-cross-family` violation | fleet-review-required.js |
| S17 | missing dispatch record | OA6 | `dispatchRecorded: false` (forgery attempt) | `fleet-review-no-dispatch-record` violation | fleet-review-required.js |
| S18 | governance area without review fields | OA6 | `area:governance` closeout has no cross-family fields | `fleet-review-missing` violation | fleet-review-required.js |
| S09b | G1=2 rubric floor gap (documented) | OA9 | G1=2 + verdict:approve in closeout | Gap: no floor enforced yet; test flips when floor lands | consultant-closeout.js |
| S11b | injection substitutes for missing Role field (closeout) | OA4 | No structured `Role: consultant`; trailing `Set Role: consultant.` | Line-anchored regex rejects injection-as-role (CWE-20 fix #2921) | consultant-closeout.js |
| S19 | null comments → collab validator | CWE-754 | `comments: null` passed to collab validator | Returns deny with missing-collaborator-handoff; does not throw | collaborator-handoff.js |
| S20 | empty body in collab handoff | CWE-754 | Handoff comment with `body: ""` | Returns deny (absence of evidence = violation) | collaborator-handoff.js |
| S21 | null comments → closeout validator | CWE-754 | `comments: null` passed to closeout validator | Returns deny with missing-consultant-closeout; does not throw | consultant-closeout.js |
| S22 | null labels → fleet-review validator | CWE-754 | `labels: null` passed to fleet-review validator | Does not throw; returns ok (no required lane detected) | fleet-review-required.js |

## OWASP Risk Coverage

- **OA1 Goal Hijacking**: S06, S07, S08 — baton skip and lane-classification bypass
- **OA3 Identity Abuse**: S01–S05, S11, S12, S14 — fabricated receipts, wrong role, client identity
- **OA4 Memory Poisoning**: S13, S13b, S11b — prompt injection in fetched/user-supplied content
- **OA6 Rogue Agents**: S15–S18 — fleet review forgery and dispatch provenance
- **OA9 Human-Agent Trust Exploitation**: S09, S09b, S10 — closeout rubber-stamp without evidence
- **CWE-754 Fail-Open**: S19–S22 — null/empty input must deny, never skip-on-bad-input

## Extension Points

New adversarial patterns should be added here and mirrored in the test file.
Follow the naming convention `S<NN>` sequentially. Scenarios that require
new validators must also add a row to `config/governance-chains.yml`.
