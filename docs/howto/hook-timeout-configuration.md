# Hook Timeout Configuration (Megingjord Harness)

Per #2009 — covers Claude Code hook `timeout` fields and Bash command timeout
environment variables. Addresses the documented stream-closed race in
[anthropics/claude-code#44435](https://github.com/anthropics/claude-code/issues/44435).

## The bug

Claude Code's PreToolUse hooks have no built-in timeout. If a hook script
spawns a subprocess (e.g. `gh`, `git`) that briefly stalls, the in-flight tool
call can fail with:

```
Tool permission request failed: Error: Tool permission stream closed before
response received
```

The error is opaque — the operator cannot tell whether it was a hook stall, IDE
disconnect, or something else. Workflows that combine `git commit` with hook
subprocesses are especially prone.

## The fix

Add a numeric `timeout` (seconds) to every hook entry in
`.claude/settings.json.template`. Recommended budgets:

| Event | Recommended timeout (s) | Why |
|---|---|---|
| `PreToolUse` | 5 | Must NOT stall the permission stream; hooks should be cheap |
| `PostToolUse` | 3 | Advisory only; should never delay the next tool call |
| `Stop` | 5 | Final session-end checks; modest budget |
| `UserPromptSubmit` | 5 | Context-injection runs at every user turn |
| `SessionStart` | 5 | One-time per session boot |

Set Bash command timeouts via the top-level `env` block:

```json
"env": {
  "BASH_DEFAULT_TIMEOUT_MS": "600000",
  "BASH_MAX_TIMEOUT_MS": "1800000"
}
```

This raises the default 2-min ceiling to 10 minutes (default) / 30 minutes
(cap), which is appropriate for harness-typical CI-polling and multi-step
git/gh chains.

## Operator-unique vs harness-wide

| What | Where it lives | Why |
|---|---|---|
| `timeout` on every hook entry | Harness — `.claude/settings.json.template` | All operators hit the same bug |
| `BASH_DEFAULT_TIMEOUT_MS` / `BASH_MAX_TIMEOUT_MS` | Harness — template `env` block | Long ops are typical for this harness |
| `permissions.allow` entries (e.g. `Bash(*)`) | Operator-local — never shipped | Each operator chooses their threat model |

## Verification

Run the stress suite:

```bash
npx playwright test tests/stress-hook-timing.spec.js
```

This asserts:

- every hook entry in the deployed template has a numeric `timeout`
- `env.BASH_DEFAULT_TIMEOUT_MS` and `BASH_MAX_TIMEOUT_MS` are set
- `PreToolUse` timeouts are ≤ 5s
- `pretool_guard.py` and `baton_gate.py` spawn complete in <2s under typical load

## After applying the fix

1. `git pull` to receive the updated template
2. `npm run deploy:apply` (or `deploy:claude`) to refresh deployed settings
3. Restart any in-flight Claude Code session so the new env vars and hook timeouts take effect

## References

- [anthropics/claude-code#44435](https://github.com/anthropics/claude-code/issues/44435) — stream-closed race
- [Claude Code hooks reference](https://code.claude.com/docs/en/hooks)
- [Claude Code settings docs](https://docs.claude.com/en/docs/claude-code/settings)
- [Boris Cherny on Threads](https://www.threads.com/@boris_cherny/post/DPfcevpEWnO) — settings override confirmation
- Related closed: #1960 (Stop hook misfire), #1975 (state-store branch reset), #1999 (MD018 hotfix)
