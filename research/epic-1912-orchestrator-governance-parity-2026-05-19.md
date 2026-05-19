# Epic 1912 Orchestrator Governance Parity

## Result

The harness does not yet prove exact governance parity across Claude Code,
Copilot, and Codex. It has strong shared governance intent, but adapter coverage
is uneven enough that portability needs follow-up implementation.

## Evidence Matrix

| Surface | Claude Code | Copilot | Codex | Rating |
|---|---|---|---|---|
| Instructions | `CLAUDE.md` adapter | `.github/copilot-instructions.md` | `.codex/AGENTS.md` | good |
| Hooks/gates | no `hooks` in repo settings | seven events wired | five events wired | weak |
| Prompt gates | skill route only | includes `goal_lens.py` | missing `goal_lens.py` | weak |
| Permission gates | native possible | no native event | `PermissionRequest` unmapped | weak |
| Deploy/sync | `.claude/` only | broad asset deploy | codex runtime deploy | weak |
| Skills/commands | missing command adapters | skills deployed | agent skills available | partial |
| Parity tests | not covered | partial | partial | weak |

## Must-Fix Development Children

1. #1917: Add a Claude Code hook/settings adapter for governance gates.
2. #1918: Normalize deploy/sync targets so `all` means all three runtimes.
3. #1919: Wire Codex parity gates for `goal_lens.py` and `PermissionRequest`.
4. #1920: Generate or waive Claude command adapters for canonical skills.
5. #1921: Promote `governance:orchestrator-parity` to strict CI.

## Sources

- OpenAI Codex docs: <https://developers.openai.com/codex/cli/slash-commands>
- OpenAI Codex config: <https://developers.openai.com/codex/config-reference#configtoml>
- Claude Code hooks: <https://docs.anthropic.com/en/docs/claude-code/hooks>
- Copilot instructions: <https://docs.github.com/en/copilot/how-tos/custom-instructions/adding-repository-custom-instructions-for-github-copilot>
- Copilot coding agent: <https://docs.github.com/en/copilot/using-github-copilot/coding-agent/about-assigning-tasks-to-copilot>

## Recommendation

Treat #1912 as complete when this planning artifact, the parity manifest, the
audit command, and the follow-up tickets land. Do not close the implementation
gap silently inside this Epic; each adapter change should use a focused child
ticket with single-team file ownership.

Signed-by: Quill Harper
Team&Model: codex:gpt-5.4@openai
Role: collaborator
