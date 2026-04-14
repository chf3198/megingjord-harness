# Development Workflow Design

**Status**: Accepted
**Date**: 2026-04-13
**Diagrams**: [workflow-diagrams.md](workflow-diagrams.md)

## Purpose

Define the end-to-end development workflow that every VS Code Copilot agent chat session must follow. This is the single reference for how the 4-layer enforcement system works together.

## Enforcement Architecture (4 Layers)

| Layer | Location | Mechanism | Failure mode |
|---|---|---|---|
| **Instructions** | `~/.copilot/instructions/*.md` | Loaded before first response; `applyTo: "**"` | Agent ignores (soft) |
| **Hooks** | `~/.copilot/hooks/scripts/*.py` | Execute at runtime events; can BLOCK | Timeout / crash (logged) |
| **Skills** | `~/.copilot/skills/*/SKILL.md` | Agent invokes on-demand per instructions | Agent skips (soft) |
| **Bootstrap** | `.github/instructions/` per repo | First instruction agent sees in workspace | Missing if not bootstrapped |

## The Baton Sequence

Every non-trivial task follows **Manager → Collaborator → Admin → Consultant**. One role active at a time. Each emits a named handoff artifact before the next begins.

| Role | Responsibility | Artifact | Skill |
|---|---|---|---|
| Manager | Scope, constraints, acceptance criteria, gates | `MANAGER_HANDOFF` | `role-manager-execution` |
| Collaborator | Implement, test, produce gate evidence | `COLLABORATOR_HANDOFF` | `role-collaborator-execution` |
| Admin | Git ops, PR, CI, merge, publish, release | `ADMIN_HANDOFF` | `role-admin-execution` |
| Consultant | Independent critique, risk review, recommendations | `CONSULTANT_CLOSEOUT` | `role-consultant-critique` |

**Trivial-task escape**: Skip baton only when ALL true: single Q&A, no file edits, no terminal commands, no state-changing tool calls.

## Hook Enforcement Points

| Event | Script | Action |
|---|---|---|
| SessionStart | `session_context.py` | Inject MANDATORY baton message + project profile |
| UserPromptSubmit | `userprompt_gate.py` | Block "done/finish" if Admin ops incomplete |
| PreToolUse | `pretool_guard.py` | DENY push→commit, merge→CI violations |
| PostToolUse | `posttool_reminders.py` | Track tool activity, remind of missing steps |
| Stop | `stop_reminder.py` | BLOCK stop with uncommitted changes |

## Adaptive Profiles

`detect_repo_type(cwd)` classifies the repo and sets Admin gate requirements:

| Type | Detection | Admin Gates |
|---|---|---|
| vscode-extension | `vscode-extension/package.json` or `mem-watchdog.sh` | Base + publish + integrity + gh release |
| web-app | package.json with react/next/vue/svelte | Base + strict docs-drift |
| website-static | Has `.html` + `.css` files | Base + strict docs-drift |
| infra-automation | `.github/workflows/` + ≥3 shell scripts | Base + governance checks |
| library-sdk | package.json without framework deps | Base only |
| generic | Fallback | Base only |

**Base gates**: commit → push → PR create → CI green → merge.

## Key Instructions (9 global)

| Instruction | Scope |
|---|---|
| `role-baton-routing` | Baton rules, trivial escape, local override |
| `operator-identity-context` | Agent=operator, user=client, automation mandate |
| `feature-completion-governance` | All 4 artifacts required before "done" |
| `global-standards` | Root-cause, evidence, secrets, docs |
| `workflow-resilience` | Self-anneal triggers and docs-drift detection |
| `release-docs-hygiene` | Post-merge checklist (6 mandatory steps) |
| `repo-health-onboarding` | Community health baseline, standards routing |
| `github-governance` | Ticket lifecycle, review/merge, Actions security |
| `playwright-mcp-low-resource` | Bounded browser automation on constrained hardware |

## Known Gap

No hook hard-blocks coding before `MANAGER_HANDOFF`. The agent receives the instruction but isn't physically prevented from starting implementation. Could be closed with a PreToolUse check for `create_file`/`apply_patch` verifying manager role is marked in governance state.

## Governance State

Persistent JSON per-repo at `~/.copilot/hooks/state/repo-{hash}.json`. Tracks:
- Role completion flags (manager, collaborator, admin, consultant)
- File touch flags (code, docs, extension)
- Admin operation completion (commit, push, pr_create, ci_green, merge, publish, etc.)

State resets on new sessions, persists across tool calls within a session.
