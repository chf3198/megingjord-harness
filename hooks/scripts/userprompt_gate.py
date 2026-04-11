#!/usr/bin/env python3
"""UserPromptSubmit hook: pre-closeout governance gating hints."""
import json
import os
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from governance_state import ensure_state


FINISH_RE = re.compile(r"\b(done|finish|finished|complete|completed|close out|wrap up|ship|release)\b", re.IGNORECASE)


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return 0

    prompt = str(payload.get("prompt", ""))
    if not FINISH_RE.search(prompt):
        return 0

    cwd = str(payload.get("cwd") or os.getcwd())
    state = ensure_state(cwd)
    flags = state.get("flags", {})
    ops = state.get("admin_ops", {})
    repo_type = state.get("repo_type", "generic")

    missing = []
    if flags.get("code_touched", False):
        missing.extend([k for k in ("commit", "push", "pr_create", "ci_green", "merge") if not ops.get(k, False)])
    if repo_type == "vscode-extension" and flags.get("extension_touched", False):
        missing.extend([k for k in ("publish", "release_integrity", "gh_release") if not ops.get(k, False)])

    if not missing:
        return 0

    out = {
        "hookSpecificOutput": {
            "hookEventName": "UserPromptSubmit",
            "additionalContext": (
                "Finish intent detected, but Admin baton is incomplete. "
                "Missing required steps: " + ", ".join(missing) + "."
            ),
        },
        "systemMessage": "Governance gate: completion requested before required Admin steps were recorded.",
    }
    print(json.dumps(out))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
