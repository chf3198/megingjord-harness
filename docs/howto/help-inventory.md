# HELP Documentation Inventory

Audit of all 36 skills in `skills/`. None currently have `HELP.md` files.

Generated: 2026-04-30 | Refs #522 #335

## Coverage Summary

| Metric | Count |
| --- | --- |
| Total skills | 36 |
| Have `HELP.md` | 0 |
| Have `INSTALL-GLOBAL.md` | 8 |
| Developer HOWTOs (`docs/howto/`) | 0 |
| CI doc-update gate | none |

## Skills by Category

### Agile Baton Roles (5)

| Skill | Files | HELP gap |
| --- | --- | --- |
| `role-manager-execution` | SKILL.md | No HOWTO for Manager phase entry/exit |
| `role-collaborator-execution` | SKILL.md | No HOWTO for Collaborator evidence format |
| `role-admin-execution` | SKILL.md | No HOWTO for Admin merge checklist |
| `role-consultant-critique` | SKILL.md | No HOWTO for grading rubric in practice |
| `role-baton-orchestrator` | SKILL.md | No HOWTO for end-to-end baton sequence |

**Gap**: No single document shows a developer how to run a ticket start-to-finish.
**Fix**: `docs/howto/baton-workflow.md` (#639)

### Fleet Routing (3)

| Skill | Files | HELP gap |
| --- | --- | --- |
| `global-task-router` | SKILL.md | No HOWTO for reading routing decisions |
| `fleet-model-optimizer` | SKILL.md | No HOWTO for configuring thresholds |
| `openrouter-free-failover` | SKILL.md | No HOWTO for fallback chain |

**Gap**: No guide explains lane selection, complexity scoring, or `npm run cost-report`.
**Fix**: `docs/howto/fleet-routing.md` (#640)

### GitHub Governance (8)

| Skill | Files | HELP gap |
| --- | --- | --- |
| `github-ticket-lifecycle-orchestrator` | SKILL.md | No HOWTO linking to label taxonomy |
| `github-ops-tree-router` | SKILL.md references | No HOWTO for routing decisions |
| `github-ops-excellence` | INSTALL-GLOBAL.md SKILL.md | INSTALL guide exists; no usage HOWTO |
| `github-review-merge-admin` | SKILL.md | No HOWTO for merge gate checklist |
| `github-projects-agile-linkage` | SKILL.md | No HOWTO for project field setup |
| `github-release-incident-flow` | SKILL.md | No HOWTO for incident response |
| `github-actions-security-hardening` | SKILL.md | No HOWTO for pin-to-SHA workflow |
| `github-ruleset-architecture` | SKILL.md | No HOWTO for layered rulesets |
| `github-capability-resolver` | SKILL.md | No HOWTO; used by router only |

**Gap**: `github-review-merge-admin` and `github-release-incident-flow` are the most
operator-facing but have no walkthrough documentation.

### Repository Standards (5)

| Skill | Files | HELP gap |
| --- | --- | --- |
| `repo-onboarding-standards` | SKILL.md | No HOWTO for new repo checklist |
| `repo-profile-governance` | INSTALL-GLOBAL.md SKILL.md | Install guide only |
| `repo-standards-router` | INSTALL-GLOBAL.md SKILL.md | Install guide only |
| `repo-structure-conventions` | SKILL.md | No HOWTO for layout enforcement |
| `web-regression-governance` | INSTALL-GLOBAL.md SKILL.md | Install guide only |

### Operator Identity and Context (2)

| Skill | Files | HELP gap |
| --- | --- | --- |
| `operator-identity-context` | INSTALL-GLOBAL.md SKILL.md | Install guide exists; no usage HOWTO |
| `global-skills-bootstrap` | bin INSTALL-GLOBAL.md SKILL.md templates | Most complete; no HOWTO |

### Documentation and Release (4)

| Skill | Files | HELP gap |
| --- | --- | --- |
| `docs-drift-maintenance` | SKILL.md | No HOWTO for drift detection workflow |
| `release-version-integrity` | SKILL.md | No HOWTO for pre-tag checklist |
| `secret-exposure-prevention` | SKILL.md | No HOWTO for pre-publish scan |
| `manager-ticket-lifecycle` | SKILL.md | No HOWTO for ticket creation ceremony |

### LLM Wiki (2)

| Skill | Files | HELP gap |
| --- | --- | --- |
| `llm-wiki-ops` | SKILL.md | No HOWTO for ingest/anneal/search |
| `llm-wiki-ops-portable` | SKILL.md | No HOWTO for portable deployment |

### Infrastructure and Platform (7)

| Skill | Files | HELP gap |
| --- | --- | --- |
| `network-platform-resources` | SKILL.md | No HOWTO |
| `mem-watchdog-ops` | SKILL.md watchdog-snapshot.sh | Script exists; no HOWTO |
| `openclaw-availability-utilization` | SKILL.md | No HOWTO |
| `openclaw-universal-system` | SKILL.md | No HOWTO |
| `playwright-vision-low-resource` | INSTALL-GLOBAL.md scripts SKILL.md templates | Most complete |
| `workflow-self-anneal` | INSTALL-GLOBAL.md SKILL.md | Install guide; no usage HOWTO |

## Priority HELP Gaps

These are the highest-impact gaps — used in every session, no documentation:

| Priority | Gap | Blocking? |
| --- | --- | --- |
| P1 | End-to-end baton workflow (ticket → merged PR) | Yes — blocks new contributors |
| P1 | Fleet routing: lane selection and cost-report | Yes — misrouting causes cost spiral |
| P1 | Adding a new skill (CONTRIBUTING.md covers this but no HOWTO) | Partial |
| P2 | Incident response flow | No — rarely needed |
| P2 | Wiki ingest/search | No — power-user only |

## Existing Doc Surfaces (Not Skills)

| Surface | Location | Coverage |
| --- | --- | --- |
| Baton workflow rules | `instructions/role-baton-routing.instructions.md` | Complete but machine-readable |
| Fleet routing policy | `instructions/global-task-router.instructions.md` | Complete but machine-readable |
| Contributing guide | `CONTRIBUTING.md` | Covers skill creation; no baton HOWTO |
| Research docs | `research/` | Ad-hoc; not indexed |
| Runbooks | `research/ollama-keepalive-runbook.md` | Single runbook; no index |
