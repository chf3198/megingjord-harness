#!/usr/bin/env python3
"""PreTool: require ticket linkage on a commit when the branch carries a ticket.

Anneal-lane carve-out (Epic #3576 W-A / A3): on a rolling `anneal/<ISO-week>`
branch, a commit may carry an `incident:<pattern_id>` ref in lieu of `#N`.
Linkage stays REQUIRED — the lane swaps a ticket ref for an incident ref.
"""
import json
import os
import re
import subprocess
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from repo_scope import is_repo_enabled
from ticket_helpers import extract_issue_num, extract_from_branch
from governance_state import ensure_state, save_state

ANNEAL_RE = re.compile(r"^anneal/\d{4}-W\d{2}$")   # rolling weekly self-anneal lane
INCIDENT_RE = re.compile(r"incident:[a-z0-9][a-z0-9-]*")  # accepted in lieu of #N


def get_current_branch() -> str:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            text=True, stderr=subprocess.DEVNULL).strip()
    except Exception:
        return ""


def emit(decision: str, reason: str) -> int:
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": decision,
        "permissionDecisionReason": reason}}))
    return 0


def _bump(cwd: str, *keys: str) -> None:
    state = ensure_state(cwd)
    d = state.setdefault("drift", {})
    for k in keys:
        d[k] = d.get(k, 0) + 1
    save_state(state)


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return 0

    tool = str(payload.get("tool_name", ""))
    cwd = str(payload.get("cwd") or os.getcwd())
    if not is_repo_enabled(cwd):
        return 0

    values = list(payload.get("tool_input", {}).values() if isinstance(
        payload.get("tool_input"), dict) else [])
    joined = "\n".join(str(v) for v in values)
    if tool not in {"run_in_terminal", "terminal", "Bash"} or "git commit" not in joined:
        return 0

    branch = get_current_branch()

    if ANNEAL_RE.match(branch):  # anneal lane: incident ref (or #N) satisfies linkage
        if INCIDENT_RE.search(joined) or extract_issue_num(joined):
            _bump(cwd, "commits", "commits_with_ticket", "anneal_commits")
            return 0
        return emit("deny",
                    f"Anneal branch '{branch}' requires an `incident:<pattern_id>` "
                    "reference (or a `#N` ticket ref). e.g. "
                    "git commit -m \"chore(anneal): ... (incident:raw-fleet-curl-bypasses-hamr)\"")

    branch_issue = extract_from_branch(branch)
    if not branch_issue:
        return 0

    commit_issue = extract_issue_num(joined)
    if not commit_issue:
        return emit("deny", f"Branch #{branch_issue} requires ticket reference in commit. "
                    f"Use: git commit -m \"...(closes #{branch_issue})\"")
    if branch_issue != commit_issue:
        return emit("deny", f"Ticket mismatch: branch #{branch_issue} vs commit "
                    f"#{commit_issue}. Branch and commit must reference the same ticket.")

    _bump(cwd, "commits", "commits_with_ticket")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
