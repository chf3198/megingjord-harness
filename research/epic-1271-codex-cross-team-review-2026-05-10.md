# Epic #1271 Codex Cross-Team Review

**Ticket**: #1284  
**Parent Epic**: #1271  
**Reviewed plans**: Claude Code #1272, Copilot #1273, Codex #1274  
**Date**: 2026-05-10

## Summary

Codex agrees with the emerging cross-team synthesis: ship a governance-first
Wave 1, then a report-only reconciliation layer, then deeper dependency and
measurement automation. The strongest final plan combines:

- Claude Code's ordering discipline: `EPIC_RESCOPE` hard gate and independent
  Consultant authority before automation writes state.
- Copilot's platform currency: GitHub issue fields, hierarchy, semantic search,
  release-linked issue evidence, and rulesets bypass provenance.
- Codex's implementation shape: one AC truth table feeding close-readiness,
  dependency reconciliation, measuring exceptions, and GHS signals.

## Critical Comparison

| Topic | Copilot #1273 | Claude Code #1272 | Codex #1274 | Codex review |
| --- | --- | --- | --- | --- |
| First shipped control | Reconciler + GHS first | `EPIC_RESCOPE` first | Reconciler + close gate first | Adopt Claude's rescope/Consultant gate first, but immediately pair with Codex close-readiness JSON contract. |
| GitHub 2026 fit | Strong | Weak | Moderate | Copilot wins. Issue fields and hierarchy should be optional adapters, not the only source of truth. |
| Independence model | Consultant close authority | Strongest four-eyes argument | Consultant-only closeout | Claude wins the principle; Codex wins the concrete closeout contract. |
| Dependency handling | Broad issue DAG | Epic-only DAG | Native API + text fallback | Merge Copilot's breadth with Codex fallback and rate-limit handling. |
| Time windows | `status:measuring` | `status:awaiting-measurement` | `status:measuring` | Use `status:measuring`; store `Recheck-after` in portable body schema first. |
| Wiki hygiene | Extends canonical concept | Adds parallel concept | Creates canonical concept | Merge `[[epic-ac-reconciliation]]` into `[[epic-state-truthfulness]]` during implementation. |
| Rollout safety | 2-week shadow mode | Advisory lint | Advisory/backcompat mode | Require report-only shadow mode before write-back or close blocking, except `EPIC_RESCOPE`. |

## Findings

1. Copilot's plan is the best platform-native plan, but over-trusts preview and
   rate-limited GitHub surfaces. GitHub issue fields are public preview and
   currently scoped to selected organizations; semantic issue search has a
   10-request/minute budget. These should be adapters behind a portable
   Markdown/body schema, not hard dependencies.
2. Claude Code's plan is the best governance-ordering plan, but it underuses
   current GitHub primitives and scopes dependency resolution too narrowly.
   `depends-on-epic` should become all-issue dependency DAG support.
3. Codex's plan is the best implementation-contract plan, but should adopt
   Copilot's sub-issue/platform evidence surface and Claude's Wave 1 ordering.
4. All three plans still lack implementation-grade success metrics. Before
   filing implementation children, define pass/fail targets such as: zero closed
   Epics with unchecked ACs, 100% `EPIC_RESCOPE` schema validity, and no
   `complete` close narrative when reconciler status is not `ready_to_close`.

## Recommended Synthesis

Wave 1: Governance certainty.

- `EPIC_RESCOPE` schema + closeout-schema hard gate.
- Consultant-only `CONSULTANT_EPIC_CLOSEOUT`, with signer independence.
- Reconciler JSON schema agreed, but report-only except rescope validation.
- Source-of-truth priority: body schema as portable baseline; issue fields as
  typed adapter when available.

Wave 2: Continuous truth table.

- `epic-ac-reconcile.js` emits one deterministic row per AC.
- `epic-close-readiness` v2 consumes reconciler JSON.
- GHS signals: `declared_complete_unmet_ac`, `rescope_missing`,
  `measuring_overdue`, `dependency_cycle`.
- Manager narrative lint advisory-first, then required after shadow window.

Wave 3: Dependency and measuring depth.

- All-issue dependency DAG using native issue-dependency API plus text fallback.
- `status:measuring` state machine with `Measure-window`, `Recheck-after`, and
  `Sensor` fields.
- Rate-limit budget and backoff for dependency/search adapters.

Wave 4: Migration and hardening.

- Backfill/advisory audit for #1130, #1103, #1113, and #1211.
- Merge duplicate wiki concepts.
- Define operator-visible dashboard/reporting for Epic truthfulness.

## Websearch Evidence

- GitHub Issue Fields, 2026-03-12: typed metadata has APIs, timeline events,
  and field webhooks, but is public preview for selected orgs. Use as adapter,
  not sole truth source. https://github.blog/changelog/2026-03-12-issue-fields-structured-issue-metadata-is-in-public-preview/
- GitHub hierarchy GA, 2026-03-19: sub-issue hierarchy improves project-level
  dependency visibility. Supports Copilot's platform direction. https://github.blog/changelog/2026-03-19-hierarchy-view-in-github-projects-is-now-generally-available/
- GitHub semantic issue search GA, 2026-04-02: hybrid/semantic search is API
  available but limited to 10 requests/minute. Sensors need budgets. https://github.blog/changelog/2026-04-02-improved-search-for-github-issues-is-now-generally-available/
- GitHub release issue sidebar/defaults, 2026-04-09: release evidence and
  project defaults can feed AC evidence adapters. https://github.blog/changelog/2026-04-09-release-info-in-issue-sidebar-and-project-defaults/
- GitHub rulesets bypass actors, 2026-05-07: bypass provenance should be linked
  to `EPIC_RESCOPE` exceptions. https://github.blog/changelog/2026-05-07-repository-rulesets-user-bypass-and-branch-renaming/
- GitHub REST rate limits: secondary limits apply across REST/GraphQL. Native
  dependency and search adapters need low-write, backoff-safe design. https://docs.github.com/en/enterprise-cloud@latest/rest/using-the-rest-api/rate-limits-for-the-rest-api
- Zhong et al. 2026: agentic code review scales screening, but human/contextual
  oversight remains necessary. Supports Consultant authority. https://arxiv.org/abs/2603.15911
- Requirements oversight paper, 2025: GenAI systems need explicit human
  oversight requirements. Supports signer-independence and close authority. https://arxiv.org/abs/2511.13069
- Rethinking SE for agentic AI, 2026: engineering shifts toward verification,
  orchestration, and accountability. Supports reconciler-first governance. https://arxiv.org/abs/2604.10599
- Verifiability-first AIware, 2026: scalable AI systems need verification
  architecture, not trust in generated claims. Supports AC truth tables. https://papers.ssrn.com/sol3/papers.cfm?abstract_id=6031534

## Ticket Notes Posted

Post concise review notes to #1271, #1272, #1273, and #1274 after this artifact
lands. Keep #1284 as the governed delivery ticket and do not file
implementation children before operator synthesis.

Signed-by: Nova Harper  
Team&Model: codex:gpt-5@codex-cli  
Role: collaborator
