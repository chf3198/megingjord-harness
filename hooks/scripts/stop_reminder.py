#!/usr/bin/env python3
"""Stop hook: governance-aware session completion reminder.

Detects whether the session involved code changes, merges, or deploys,
and reminds the agent about specific post-merge governance skills.

Also detects uncommitted working-tree changes and injects a BLOCKING
Admin-role-incomplete message when the session ends dirty.
"""
import json
import os
import subprocess
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from governance_state import ensure_state, save_state


def detect_session_signals(cwd: str) -> list[str]:
    """Detect what happened in this session by checking git state."""
    signals = []
    try:
        # Check for recent commits (last 2 hours) that suggest a merge/deploy happened
        result = subprocess.run(
            ["git", "log", "--oneline", "--since=2 hours ago", "--no-walk", "HEAD"],
            capture_output=True, text=True, cwd=cwd, timeout=5
        )
        if result.returncode == 0 and result.stdout.strip():
            signals.append("recent-commits")

        # Check if any tracked files were modified in last commit
        result = subprocess.run(
            ["git", "diff", "--name-only", "HEAD~1", "HEAD"],
            capture_output=True, text=True, cwd=cwd, timeout=5
        )
        if result.returncode == 0:
            changed = result.stdout.strip().split("\n")
            changed = [f for f in changed if f]
            if any(f.endswith(".sh") or f.endswith(".js") or f.endswith(".py") for f in changed):
                signals.append("code-changed")
            if any("README" in f or "CHANGELOG" in f for f in changed):
                signals.append("docs-updated")
            if any(f.startswith("vscode-extension/") for f in changed):
                signals.append("extension-changed")
    except Exception:
        pass
    return signals


def detect_uncommitted_changes(cwd: str) -> list[str]:
    """Return list of uncommitted working-tree files (staged or unstaged).

    Uses 'git status --porcelain' — the correct check for whether the Admin
    role has been fulfilled. HEAD~1..HEAD only sees committed diffs and is
    blind to the most critical signal: session ending with dirty working tree.
    """
    try:
        result = subprocess.run(
            ["git", "status", "--porcelain"],
            capture_output=True, text=True, cwd=cwd, timeout=5
        )
        if result.returncode == 0 and result.stdout.strip():
            return [line[3:] for line in result.stdout.strip().split("\n") if line.strip()]
    except Exception:
        pass
    return []


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

    # BLOCKING check: uncommitted working-tree changes mean Admin role was never fulfilled
    if uncommitted:
        code_uncommitted = [
            f for f in uncommitted
            if any(f.endswith(ext) for ext in (".sh", ".js", ".py", ".ts", ".json", ".md"))
        ]
        if code_uncommitted:
            sample = code_uncommitted[:5]
            sample_str = ", ".join(sample) + ("..." if len(code_uncommitted) > 5 else "")
            messages.append(
                "ADMIN ROLE INCOMPLETE — session is ending with uncommitted changes.\n"
                f"Uncommitted files ({len(code_uncommitted)}): {sample_str}\n"
                "The Admin role MUST be executed before this feature is done:\n"
                "  1. Version collision check (bump package.json if version already published)\n"
                "  2. git add -A && git commit -m 'type(scope): desc' (Closes #N in body)\n"
                "  3. git push -u origin <branch>\n"
                "  4. gh pr create with Closes #N, milestone, labels, gate-suite evidence\n"
                "  5. Wait for CI green; do NOT merge with red checks\n"
                "  6. gh pr merge\n"
                "  7. If vscode-extension/ changed: npm run build && npx vsce publish\n"
                "  8. bash scripts/release-integrity-check.sh --post-publish\n"
                "  9. gh release create vX.Y.Z\n"
                " 10. gh issue close N\n"
                "'All validation gates pass' means Collaborator is done — NOT that Admin is done."
            )
            block_reason = "Stop blocked: uncommitted changes detected; Admin baton is incomplete."

    # Project-type adaptive admin completion enforcement.
    base_required = ["commit", "push", "pr_create", "ci_green", "merge"] if flags.get("code_touched", False) else []
    ext_required = []
    if repo_type == "vscode-extension" and flags.get("extension_touched", False):
        ext_required = ["publish", "release_integrity", "gh_release"]

    missing_base = [k for k in base_required if not ops.get(k, False)]
    missing_ext = [k for k in ext_required if not ops.get(k, False)]

    if not block_reason and (missing_base or missing_ext):
        missing = missing_base + missing_ext
        block_reason = "Stop blocked: required Admin baton steps are missing (" + ", ".join(missing) + ")."
        messages.append(
            "Hard governance gate triggered. Missing Admin steps: "
            + ", ".join(missing)
            + "."
        )

    if not block_reason and flags.get("code_touched", False):
        if not roles.get("admin", False):
            block_reason = "Stop blocked: Admin role not complete for code-changing session."
            messages.append("Admin role is not marked complete in governance state.")

    # Post-merge governance checklist
    if "code-changed" in signals or "extension-changed" in signals:
        messages.append(
            "Post-merge governance checklist — verify before ending:\n"
            "1. CHANGELOG updated for all shipped behavioral changes\n"
            "2. README/docs reflect new behavior (kill hierarchy, commands, settings)\n"
            "3. repo-profile-governance: community health files, metadata, templates\n"
            "4. docs-drift-maintenance: no stale docs contradicting new behavior\n"
            "5. Learnings entry if significant discovery was made\n"
            "If these were already completed or are not applicable, proceed."
        )
    elif not messages:
        messages.append(
            "Before ending: confirm claimed checks/releases are evidence-backed "
            "and docs are synchronized where behavior/config changed."
        )

    out = {"systemMessage": "\n\n".join(messages)}
    if block_reason:
        out["hookSpecificOutput"] = {
            "hookEventName": "Stop",
            "decision": "block",
            "reason": block_reason,
        }

    # Mark consultant closeout only when the stop is allowed.
    if not block_reason:
        roles["consultant"] = True
        save_state(state)

    print(json.dumps(out))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
