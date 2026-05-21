# Safe Playwright Invocation (Megingjord Harness)

Per #2019. Mitigates the documented [microsoft/playwright#27048](https://github.com/microsoft/playwright/issues/27048) family of bugs that cause `process.js` workers to consume 98-200% CPU forever when their parent runner exits early or their stdout pipe closes.

## The bug

Pattern that triggers the runaway:

```bash
npx playwright test foo.spec.js --reporter=line 2>&1 | tail -8
```

`tail` reads its 8 lines and closes the pipe. Playwright workers' subsequent stdout writes get `SIGPIPE`, but worker handling of `SIGPIPE` is broken — the workers enter a busy loop. They never exit. Each subsequent test invocation spawns more workers. They accumulate.

Observed: a 6.3GiB container hit `virtio_balloon: Out of puff` (memory exhaustion) after 9 such zombies accumulated over 13 hours, causing Claude Code session terminations.

Related Playwright upstream bugs:

- [microsoft/playwright#27048](https://github.com/microsoft/playwright/issues/27048) — hangs after run
- [microsoft/playwright#34190](https://github.com/microsoft/playwright/issues/34190) — zombie node children after close()
- [microsoft/playwright#26980](https://github.com/microsoft/playwright/issues/26980) — continues running on CTRL+C
- [microsoft/playwright#38276](https://github.com/microsoft/playwright/issues/38276) — runner hangs after completion

## The pattern to use

Replace pipe-to-tail with file-capture + read:

```bash
# UNSAFE — DO NOT USE
npx playwright test foo.spec.js --reporter=line 2>&1 | tail -8

# SAFE — file capture, no pipe-tail
npx playwright test foo.spec.js --workers=1 --max-failures=5 --reporter=line > /tmp/pw-out.txt 2>&1
tail -n 8 /tmp/pw-out.txt
```

Or use the wrapper directly:

```bash
scripts/global/safe-playwright.sh tests/your-spec.js
```

The wrapper applies these mandatory defaults:

- `--workers=1` — no fan-out (the zombie multiplier)
- `--max-failures=5` — bail before runaway accumulation
- `--reporter=line` — single-line output (cap volume)
- File capture (no pipe-tail)

## SessionStart cleanup

`hooks/scripts/zombie_cleanup.py` runs at SessionStart per the configured hook entry. It walks `/proc`, identifies orphaned playwright workers (CPU criteria met OR parent dead AND age > 5 min), and escalates SIGTERM → SIGKILL (with 5s grace).

Cleanup events log to `~/.megingjord/zombie-cleanup.jsonl` for audit.

## Operator commands

```bash
# Verify no zombies currently
python3 hooks/scripts/zombie_cleanup.py

# Run a spec safely (per AC2)
PLAYWRIGHT_TAIL_LINES=15 scripts/global/safe-playwright.sh tests/my-spec.spec.js

# Inspect cleanup history
tail -20 ~/.megingjord/zombie-cleanup.jsonl
```

## References

- Origin Epic: #1962 (red-team finding via #2019 self-anneal)
- Related: #2009 (PreToolUse hook timeouts), #1960 (Stop hook misfire)
- Upstream: microsoft/playwright#27048
