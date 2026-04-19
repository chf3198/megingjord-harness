#!/usr/bin/env python3
"""Stop hook: governance-aware session completion reminder.

Delegates git state detection to git_checks and admin completion
logic to stop_checks. Orchestrates blocking decisions and messages.
"""
import json
import os
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from git_checks import detect_session_signals, detect_uncommitted_changes
from governance_state import ensure_state, save_state
from stop_checks import check_admin_ops, check_uncommitted, post_merge_messages


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        payload = {}

    if payload.get("stop_hook_active"):
        return 0

    cwd = payload.get("cwd") or os.getcwd()
    state = ensure_state(cwd)
    signals = detect_session_signals(cwd)
    uncommitted = detect_uncommitted_changes(cwd)
    flags = state.get("flags", {})
    ops = state.get("admin_ops", {})
    roles = state.get("roles", {})
    repo_type = state.get("repo_type", "generic")

    messages = []
    block_reason = None

    block_reason, msg = check_uncommitted(uncommitted)
    if msg:
        messages.append(msg)

    if not block_reason:
        block_reason, msg = check_admin_ops(flags, ops, roles, repo_type)
        if msg:
            messages.append(msg)

    messages.extend(post_merge_messages(signals, bool(messages)))

    drift = state.get("drift", {})
    total_c = drift.get("commits", 0)
    if total_c > 0:
        rate = (total_c - drift.get("commits_with_ticket", 0)) / total_c * 100
        messages.append(f"📊 Drift score: {rate:.0f}% ticketless ({total_c} commits this session).")

    out = {"systemMessage": "\n\n".join(messages)}
    if block_reason:
        out["hookSpecificOutput"] = {
            "hookEventName": "Stop",
            "decision": "block",
            "reason": block_reason,
        }

    if not block_reason:
        roles["consultant"] = True
        save_state(state)

    print(json.dumps(out))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
