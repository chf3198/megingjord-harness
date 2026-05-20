---
name: Cross-Team Artifact-Write Contract
description: Governs accountability when Team A authors a config/artifact that Team B's runtime parses. Target-runtime team owns the schema/contract test.
applyTo: "**"
---

# Cross-Team Artifact-Write Contract

A cross-team artifact write occurs when Team A (the authoring team) creates or
modifies a file that is **consumed and parsed by Team B's runtime**. The canonical
example is a Codex team authoring `.claude/settings.json` (a Claude Code config).
Without an explicit contract, schema-correctness accountability is ambiguous, and
the manager-handoff can be marked complete without validating runtime parseability.

## Authoring-Team Responsibilities

1. **Signal the write** — The MANAGER_HANDOFF must list every cross-runtime file
   created or modified under `cross_runtime_writes: [<path>, ...]`.
2. **Reference the schema** — The branch must include a citation to the target
   runtime's schema (doc link, JSON Schema file, or template path).
3. **Functional intent only** — The authoring team is responsible for correct
   functional intent (the right hook, key name, or value). Parse-validity is
   owned by the target team (see below).
4. **Tag target team** — Post a `TEAM_QUESTION` comment on the issue naming the
   target team and requesting schema-validation sign-off before manager-handoff.

## Target-Runtime-Team Responsibilities

1. **Own the schema test** — The target-runtime team is accountable for a
   passing schema/contract test that validates any cross-team-written config
   against the runtime's accepted format.
2. **Sign off before manager-handoff** — The target team must post a
   `TEAM_RESPONSE` comment with `verdict: schema-valid` or `verdict: schema-invalid`
   before the authoring team's MANAGER_HANDOFF can be marked complete.
3. **Maintain the test** — The schema test lives in the target team's test suite
   and is updated whenever the runtime schema changes.

## Required Artifacts Before Manager-Handoff Completes

For any ticket with `cross_runtime_writes` populated, the MANAGER_HANDOFF
evidence block must include:

```
cross_runtime_writes:
  - path: <file>
    target_team: <team>
    schema_source: <schema doc or file path>
    target_team_sign_off: <TEAM_RESPONSE comment URL or "pending">
```

A manager-handoff with `target_team_sign_off: pending` is incomplete. The baton
does NOT advance to Collaborator until sign-off is received.

## Failure Mode: Schema Regression Recovery

If a cross-team artifact write causes a runtime schema rejection after merge,
invoke the Breaking-Change Recovery Protocol from
`instructions/breaking-change-recovery.instructions.md`.

## Cross-References

- `instructions/role-baton-routing.instructions.md` — MANAGER_HANDOFF gate
- `instructions/team-model-signing.instructions.md` — TEAM_QUESTION/TEAM_RESPONSE signing
- `skills/repo-standards-router/SKILL.md` — when to flag a cross-team artifact write
