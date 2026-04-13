#!/usr/bin/env python3
"""Manager gate: validate Manager handoff includes ticket before implementation."""
import json
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from governance_state import ensure_state, save_state
from ticket_helpers import extract_issue_num


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return 0

    prompt = str(payload.get("prompt", "")).lower()
    cwd = str(payload.get("cwd") or ".")

    if not any(
        w in prompt
        for w in ["manager", "scope", "gates", "constraint", "work", "task"]
    ):
        return 0

    state = ensure_state(cwd)
    roles = state.get("roles", {})

    if roles.get("manager"):
        issue_num = extract_issue_num(prompt)
        if not issue_num:
            print(
                json.dumps(
                    {
                        "hookSpecificOutput": {
                            "hookEventName": "UserPromptSubmit",
                            "additionalContext": (
                                "Manager handoff detected but no ticket reference found. "
                                "MANAGER_HANDOFF must include a GitHub issue link (e.g., #123)."
                            ),
                        },
                        "systemMessage": "Ticket-first workflow: Manager must create ticket before scope definition.",
                    }
                )
            )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
