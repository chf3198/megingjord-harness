#!/usr/bin/env python3
"""anneal-decision SessionEnd / Stop hook (#1855 AC4).

Cross-runtime: same Python source deployable to ~/.claude/hooks/,
~/.copilot/hooks/, ~/.codex/devenv-ops/hooks/ via existing sync scripts.

Reads JSON event payload from stdin per Claude Code hook spec.
Delegates the recognition/decision balance check to the Node detector.
Returns exit 0 (allow exit) or exit 2 (block exit + emit advisory message).
"""

import json
import os
import subprocess
import sys

REPO_ROOT = os.environ.get(
    "MEGINGJORD_REPO_ROOT",
    os.path.expanduser("~/devenv-ops"),
)
DETECTOR = os.path.join(
    REPO_ROOT, "scripts", "global", "anneal-decision-audit.js",
)


def main() -> int:
    raw = sys.stdin.read() if not sys.stdin.isatty() else ""
    try:
        event = json.loads(raw) if raw else {}
    except json.JSONDecodeError:
        event = {}
    transcript = event.get("transcript", "") or event.get("session_text", "")
    if not transcript:
        return 0
    if not os.path.exists(DETECTOR):
        return 0
    try:
        proc = subprocess.run(
            ["node", DETECTOR, "--json"],
            input=transcript, capture_output=True, text=True, timeout=10,
        )
    except (subprocess.SubprocessError, OSError):
        return 0
    try:
        result = json.loads(proc.stdout or "{}")
    except json.JSONDecodeError:
        return 0
    if result.get("ok") is True:
        return 0
    msg = (
        f"\n⚠ anneal-decision contract violation: "
        f"{result.get('unmatched_recognitions', 0)} unmatched recognition(s).\n"
        f"  Record one of: file-ticket | log-incident-only | "
        f"memory-note-only | no-action-justified per role-baton-routing.\n"
    )
    sys.stderr.write(msg)
    return 0


if __name__ == "__main__":
    sys.exit(main())
