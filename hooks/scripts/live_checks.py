#!/usr/bin/env python3
"""Live GitHub API checks for pretool_guard hooks."""
import json, re, subprocess

RE_BRANCH_ISSUE = re.compile(r"(?:feat|fix|hotfix)/(\d+)-")
PENDING_STATES = {"PENDING", "IN_PROGRESS", "QUEUED", "REQUESTED", "WAITING"}
PASS_CONCLUSIONS = {"success", "skipped", "neutral"}
FAIL_CONCLUSIONS = {"failure", "failed", "timed_out", "cancelled", "action_required", "startup_failure"}


def classify_ci_checks(checks: list[dict]) -> str:
    """Classify GH checks into pending-only, failing, green, or unknown."""
    if not checks:
        return "unknown"
    has_pending = False
    for c in checks:
        state = str(c.get("state", "")).upper()
        conclusion = str(c.get("conclusion", "")).lower()
        if state in PENDING_STATES:
            has_pending = True
            continue
        if conclusion and conclusion in FAIL_CONCLUSIONS:
            return "failing"
        if state in {"FAILURE", "FAILED", "TIMED_OUT", "CANCELLED", "ACTION_REQUIRED", "ERROR"}:
            return "failing"
        if conclusion and conclusion not in PASS_CONCLUSIONS:
            return "failing"
    if has_pending:
        return "pending-only"
    return "green"


def classify_merge_flow_state(checks: list[dict], merge_policy_blocked: bool = False) -> str:
    """Extend CI classification with policy-blocked merge outcome state."""
    ci_state = classify_ci_checks(checks)
    if ci_state == "green" and merge_policy_blocked:
        return "green-but-policy-blocked"
    return ci_state


def ci_gate_status(pr_ref: str, cwd: str) -> str:
    """Fetch and classify PR check status for merge gating."""
    try:
        r = subprocess.run(
            ["gh", "pr", "checks", pr_ref, "--json", "name,state,conclusion"],
            capture_output=True, text=True, cwd=cwd, timeout=20,
        )
        checks = json.loads(r.stdout or "[]")
        return classify_ci_checks(checks)
    except Exception:
        return "unknown"


def ci_all_pass(pr_ref: str, cwd: str) -> bool:
    """Compatibility helper: True only when checks are fully green."""
    return ci_gate_status(pr_ref, cwd) == "green"


def linked_issue_has_collab_handoff(cwd: str) -> bool:
    """Return True if linked issue (from branch name) has COLLABORATOR_HANDOFF comment."""
    try:
        branch = subprocess.check_output(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            text=True, stderr=subprocess.DEVNULL, cwd=cwd,
        ).strip()
        m = RE_BRANCH_ISSUE.match(branch)
        if not m:
            return True  # branch has no ticket ref → can't block
        r = subprocess.run(
            ["gh", "issue", "view", m.group(1), "--json", "comments"],
            capture_output=True, text=True, cwd=cwd, timeout=20,
        )
        data = json.loads(r.stdout or "{}")
        return any("COLLABORATOR_HANDOFF" in c.get("body", "") for c in data.get("comments", []))
    except Exception:
        return True  # on API error → allow (fail open, not block)
