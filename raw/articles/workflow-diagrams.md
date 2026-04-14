# Workflow Diagrams

**Parent**: [workflow-design.md](workflow-design.md)

## Session Lifecycle

```
  New Chat Session
        │
  ┌─────▼──────────────────────────────────────┐
  │ SessionStart hook                           │
  │ • Detect project type                       │
  │ • Inject MANDATORY baton + profile + gaps   │
  └─────┬──────────────────────────────────────┘
        │
  ┌─────▼──────────────────────────────────────┐
  │ Trivial?  YES → answer directly, no baton  │
  │           NO  → enter baton sequence ▼      │
  └─────┬──────────────────────────────────────┘
        ▼
  ══ BATON SEQUENCE (see below) ══
```

## 4-Role Baton Sequence

```
 ┌──────────┐    ┌─────────────┐    ┌───────┐    ┌───────────┐
 │ MANAGER  │───▶│COLLABORATOR │───▶│ ADMIN │───▶│CONSULTANT │
 └──────────┘    └─────────────┘    └───────┘    └───────────┘
      │                │                │              │
 MANAGER_         COLLABORATOR_    ADMIN_         CONSULTANT_
 HANDOFF          HANDOFF          HANDOFF        CLOSEOUT

 One role active at a time.
 Each emits artifact before next begins.
```

## Per-Role Detail

```
 MANAGER: objective, constraints, criteria, gates
     │
     ▼
 COLLABORATOR: implement + test + gate evidence
     │          ⚠ "Tests pass" = Collaborator done, NOT task done
     ▼
 ADMIN: commit → push → PR → CI green → merge
     │  (+ publish → integrity → release for extensions)
     │  🔒 Hooks BLOCK out-of-order operations
     ▼
 CONSULTANT: critique, risk score, recommendations
```

## Hook Enforcement Flow

```
  User opens chat
       │
  ┌────▼─── SessionStart ─────────────────────┐
  │ Inject baton mandate + project profile     │
  └────┬───────────────────────────────────────┘
       │
  ┌────▼─── UserPromptSubmit ──────────────────┐
  │ "done/finish" + Admin incomplete → warning │
  └────┬───────────────────────────────────────┘
       │
  ┌────▼─── PreToolUse ────────────────────────┐
  │ DENY push before commit                    │
  │ DENY merge before CI green                 │
  │ DENY publish before merge                  │
  │ ASK on sensitive file access               │
  └────┬───────────────────────────────────────┘
       │
  ┌────▼─── PostToolUse ───────────────────────┐
  │ Track files touched + admin ops completed  │
  │ Remind of missing Admin steps              │
  └────┬───────────────────────────────────────┘
       │
  ┌────▼─── Stop ─────────────────────────────┐
  │ BLOCK if uncommitted changes               │
  │ BLOCK if Admin ops missing                 │
  │ Post-merge checklist reminder              │
  └────────────────────────────────────────────┘
```

## Project-Type Routing

```
  detect_repo_type(cwd)
       │
       ├── vscode-extension → Base + publish + integrity + release
       ├── web-app          → Base + strict docs-drift
       ├── website-static   → Base + strict docs-drift
       ├── infra-automation → Base + governance checks
       ├── library-sdk      → Base gates only
       └── generic          → Base gates only

  Base = commit → push → PR → CI green → merge
```
