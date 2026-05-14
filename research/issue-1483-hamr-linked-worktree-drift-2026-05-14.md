# Issue #1483 HAMR Linked Worktree Drift

## Drift Status

found

## Change Summary

HAMR activation no longer assumes `.git/` is a directory. Hook installation now
uses Git's resolved hooks path, so linked worktrees with a `.git` file can run
`npm run hamr:activate`.

Activation key checks are provider/runtime aware. `HAMR_TEAM=codex` defaults to
an OpenAI-compatible provider check, while `HAMR_TEAM=claude-code` preserves the
Anthropic path. Provider-neutral, fleet, and Ollama modes do not require a cloud
provider key during activation.

The live `/quota` smoke test now accepts schema versions newer than v2 while
preserving the required `stale` and `placeholder` fields.

## Impacted Docs

- `instructions/hamr-routing.instructions.md`: updated activation behavior and
  provider key rules.

## Validation

- `bash -n scripts/global/install-hooks.sh scripts/global/hamr-activate.sh`
- `npx playwright test tests/hamr-activate.spec.js tests/hamr-linked-worktree.spec.js tests/axis-consumers.spec.js`
- `npx playwright test tests/hamr-team-integration.spec.js`
- `npm run lint`

## Not Applicable

- Dashboard docs: no dashboard behavior changed.
- README: the command name did not change.

Signed-by: Quill Harper
Team&Model: codex:gpt-5.4@codex-cli
Role: collaborator
