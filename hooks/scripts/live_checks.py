#!/usr/bin/env python3
"""Live GitHub API checks for pretool_guard hooks."""
import json, re, subprocess

RE_BRANCH_ISSUE = re.compile(r"(?:feat|fix|hotfix)/(\d+)-")


def ci_all_pass(pr_ref: str, cwd: str) -> bool:
    """Return True if all non-pending CI checks for a PR are passing."""
    try:
        r = subprocess.run(
            ["gh", "pr", "checks", pr_ref, "--json", "name,state,conclusion"],
            capture_output=True, text=True, cwd=cwd, timeout=20,
        )
        checks = json.loads(r.stdout or "[]")
        return all(
            c.get("conclusion", "") in ("success", "skipped", "neutral")
            for c in checks if c.get("state", "") != "PENDING"
        )
    except Exception:
        return False


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
