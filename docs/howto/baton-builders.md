# Baton-artifact builders: programmatic generation of the baton trail

The harness **builds** baton artifacts from structured input rather than asking the
operator to hand-author them. Every recurring format defect — signer invention,
`Refs`-ordering, PR-title length, prose collisions, fragment naming — is encoded as
data the builder enforces, not prose the operator must remember (Epic #2037).

Builders are **pure and deterministic**: identical structured input yields
byte-identical output on any runtime (no `Date`/random/env reads in the build path),
which the cross-runtime invariant test (#2674) asserts. The signer is always
**derived** via `agent-signature` — never hand-typed — killing the signer-invention
defect class.

## The builders

| Builder | Produces | Module |
|---|---|---|
| Comment artifacts | the six baton COMMENT artifacts (MANAGER_HANDOFF, COLLABORATOR_HANDOFF, ADMIN_HANDOFF, CONSULTANT_CLOSEOUT, TEAM_QUESTION, TEAM_RESPONSE) | `scripts/global/baton-artifact-builder.js` (`buildArtifact`) |
| Comment CLI | a ready-to-post comment from flags | `scripts/global/baton-comment-build.js` (`buildBatonComment`) |
| Non-comment artifacts | PR body, CHANGELOG fragment, commit trailers | `scripts/global/baton-pr-builders.js` (`buildPrBody`, `buildChangelogFragment`, `buildCommitTrailers`) |
| Default/rollback state | whether builders are the default path | `scripts/global/baton-builder-mode.js` (`isBuilderDefault`) |

## How to invoke

Build and post a comment artifact:

```
node scripts/global/baton-comment-build.js \
  --artifact COLLABORATOR_HANDOFF --role collaborator \
  --team-model claude-code:opus@local --ticket 3271 \
  --summary "..." --related-tickets "#2708"
```

`baton-comment-build.js` fails loud on unrecognized flags (#2693), so stale callers
surface an error instead of silently dropping a field. Known flags: `--artifact`,
`--role`, `--team-model`, `--ticket`, `--fields-json`, `--summary`,
`--related-tickets`, `--overlap-decision`.

From a module (PR body + CHANGELOG fragment + trailers):

```js
const { buildPrBody, buildChangelogFragment, buildCommitTrailers } =
  require('./scripts/global/baton-pr-builders');
// PR title subject is capped at 60 chars (pr-title.yml ^.{1,60}$);
// Refs ordering and the Closes/Fixes/Resolves auto-close form are enforced.
```

## Builder-as-default and rollback

The builders are the **default** artifact path (PROMOTED in #2692: 17/17 = 1.00
byte-identical over the mined corpus). The env flag `MEGINGJORD_BATON_BUILDER_DEFAULT`
is now the **rollback switch** — set it falsy (`0`/`false`/`off`/`no`) to fall back
to the legacy hand/template path. A rollback is a one-env-var change, not a code
revert (G6). Promotion was **replay-eval-gated, not calendar-gated** — see
[baton-builder-promotion.md](baton-builder-promotion.md).

## The irreducible-3 free-text slots

Most artifacts render fully from schema. Three cases genuinely need exactly one LLM
free-text slot each (they require judgment/synthesis no schema can render). The
slot contract names, per case, the structured fields and the single free-text slot,
and `scripts/global/baton-slot-contract.js` asserts only the named slot is free-text.
See [irreducible-slot-contract.md](irreducible-slot-contract.md).

## See also

- [baton-builder-promotion.md](baton-builder-promotion.md) — the replay-eval promotion gate
- [irreducible-slot-contract.md](irreducible-slot-contract.md) — the 3 free-text slots
- [baton-workflow.md](baton-workflow.md) — the baton lifecycle the artifacts move through
- `instructions/role-baton-routing.instructions.md` — artifact schemas + gate entry conditions
- `instructions/team-model-signing.instructions.md` — signer/alias derivation
