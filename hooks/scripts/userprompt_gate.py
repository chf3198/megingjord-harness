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

from governance_state import ensure_state, save_state
from task_router import apply_route, classify_prompt


FINISH_RE = re.compile(r"\b(done|finish|finished|complete|completed|close out|wrap up|ship|release)\b", re.IGNORECASE)


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return 0

    prompt = str(payload.get("prompt", ""))
    cwd = str(payload.get("cwd") or os.getcwd())
    state = ensure_state(cwd)
    route = classify_prompt(prompt)
    apply_route(state, route)
    save_state(state)

    route_msg = None
    if route and len(prompt.split()) >= 6:
        route_msg = (
            "Task router: lane={lane}, backend={backend}, model={model}, "
            "confidence={confidence}."
        ).format(
            lane=route.get("lane", "free"),
            backend=route.get("backend", "auto"),
            model=route.get("recommendedModel", "Auto"),
            confidence=route.get("confidence", "medium"),
        )

    if not FINISH_RE.search(prompt):
        if route_msg:
            print(json.dumps({
                "hookSpecificOutput": {
                    "hookEventName": "UserPromptSubmit",
                    "additionalContext": route_msg,
                }
            }))
        return 0

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

    extra = (
        "Finish intent detected, but Admin baton is incomplete. "
        "Missing required steps: " + ", ".join(missing) + "."
    )
    if route_msg:
        extra = route_msg + " " + extra
    out = {
        "hookSpecificOutput": {
            "hookEventName": "UserPromptSubmit",
            "additionalContext": extra,
        },
        "systemMessage": "Governance gate: completion requested before required Admin steps were recorded.",
    }
    print(json.dumps(out))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
