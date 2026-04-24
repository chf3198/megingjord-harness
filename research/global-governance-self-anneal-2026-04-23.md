# Global Governance Self-Anneal Report — 2026-04-23

Date: 2026-04-23

SELF_ANNEAL_REPORT
context: post-failure
scope: workflow
observation:
- Ticket/epic work was consistently executed in local ticket markdown with strong evidence capture.
- Multiple closures relied on local state transitions without corresponding real GitHub issue lifecycle operations.
- Broad epics (#120, #121) were closed after post-hoc tranche narrowing rather than up-front scope normalization.
expected_behavior:
- Ticket and baton transitions should be reflected in GitHub issue state/labels/comments, not only local files.
- Epic closure should occur only after original AC completion or explicit approved re-scope before closeout.
- Consultant/Admin phases should enforce closure gates as hard checks.
mismatch:
- Local markdown governance choreography was stronger than actual GitHub protocol execution.
- Epic closure decisions sometimes prioritized session throughput over strict original epic AC fidelity.
root_cause: missing guardrail
risk: high
drift_signals:
- metric: ticket-linkage trend: degrading evidence: repeated local ticket updates without observable GitHub issue operations in session trace
- metric: pr-coverage trend: degrading evidence: no PR lifecycle artifacts captured for recent ticket closures
- metric: merge-latency trend: stable evidence: not enough GitHub-side data in session artifacts to score
proposed_changes:
1) file: instructions/ticket-driven-work.instructions.md  change_type: edit  rationale: require explicit "GitHub evidence block" before consultant closeout
2) file: instructions/epic-governance.instructions.md  change_type: edit  rationale: add re-scope-before-close rule and prohibit post-hoc scope normalization at closure time
3) file: instructions/workflow-resilience.instructions.md  change_type: edit  rationale: require anneal trigger when local-vs-GitHub governance divergence is detected
verification_plan:
- check: ticket closeout includes GitHub evidence block (issue state, labels, linked PR/merge or documented N/A)  pass_condition: present on all closed tickets after change
- check: epic closeout includes original AC completion map or prior re-scope artifact  pass_condition: present on all closed epics
- check: workflow resilience trigger fires when governance divergence is detected  pass_condition: anneal report produced or NO_CHANGE with evidence gap list
decision: apply
web_evidence:
- https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue
- https://raw.githubusercontent.com/github/docs/main/content/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue.md
- https://raw.githubusercontent.com/github/docs/main/content/issues/tracking-your-work-with-issues/administering-issues/closing-an-issue.md
- https://raw.githubusercontent.com/github/docs/main/content/issues/tracking-your-work-with-issues/learning-about-issues/about-issues.md
- https://raw.githubusercontent.com/github/docs/main/content/issues/using-labels-and-milestones-to-track-work/managing-labels.md

## Summary Table

| Area | Finding | Impact | Action |
|---|---|---|---|
| Ticket baton | Strong local markdown artifacts | Medium | Keep pattern, add GitHub evidence requirement |
| Epic governance | Post-hoc tranche normalization observed | High | Add re-scope-before-close guardrail |
| GitHub protocol | Weak observable issue/PR evidence in closeouts | High | Require explicit GitHub evidence block |
| Verification discipline | Good test/lint evidence, weaker protocol checks | Medium | Add governance drift checks in verification harness |

## Detailed Findings (Web-Corroborated)

1. GitHub supports explicit PR→Issue linkage plus automatic closure only when merged to default branch.
	Source: https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue

2. Closing keywords (`closes`, `fixes`, `resolves`) are valid protocol evidence and are branch-sensitive.
	Source: https://raw.githubusercontent.com/github/docs/main/content/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue.md

3. Manual issue closure is a distinct lifecycle action with explicit close reasons.
	Source: https://raw.githubusercontent.com/github/docs/main/content/issues/tracking-your-work-with-issues/administering-issues/closing-an-issue.md

4. Labels are first-class metadata used to categorize and triage issues/PRs.
	Source: https://raw.githubusercontent.com/github/docs/main/content/issues/using-labels-and-milestones-to-track-work/managing-labels.md

5. Issues are intended as persistent planning/tracking records with metadata and cross-link integration.
	Source: https://raw.githubusercontent.com/github/docs/main/content/issues/tracking-your-work-with-issues/learning-about-issues/about-issues.md

## Actionable Next Steps

1. Implement instruction hardening in #141.
2. Add governance verification harness/checklist in #142.
3. Update wiki source/index/log with this anneal report.

Last updated: 2026-04-23
