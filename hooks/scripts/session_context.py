#!/usr/bin/env python3
"""SessionStart hook: inject project-type adaptive governance context."""
import json
import os
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from governance_state import ensure_state, reset_state
from wiki_wisdom import baton_protocol, governance_enforcement, post_merge_checklist


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        payload = {}

    cwd = Path(payload.get("cwd") or os.getcwd())
    source = str(payload.get("source") or "")
    if source == "new":
        state = reset_state(str(cwd))
    else:
        state = ensure_state(str(cwd))
    repo_type = state.get("repo_type", "generic")

    signals = []
    gaps = []

    if (cwd / ".github" / "workflows").exists():
        signals.append("CI-workflow-repo")
    if (cwd / "vscode-extension").exists() or (cwd / "package.json").exists():
        signals.append("node-or-extension-repo")
    if (cwd / "README.md").exists():
        signals.append("readme-present")
    if (cwd / "CHANGELOG.md").exists() or (cwd / "vscode-extension" / "CHANGELOG.md").exists():
        signals.append("changelog-present")

    for fname in ["CONTRIBUTING.md", "CODE_OF_CONDUCT.md", "SECURITY.md", "SUPPORT.md"]:
        found = (cwd / fname).exists() or (cwd / ".github" / fname).exists()
        if not found:
            gaps.append(f"missing:{fname}")

    if not (cwd / ".github" / "CODEOWNERS").exists() and not (cwd / "CODEOWNERS").exists():
        gaps.append("missing:CODEOWNERS")

    if repo_type == "vscode-extension":
        profile = (
            "Profile=vscode-extension: hard admin gates "
            "(commit/push/PR/CI/merge) plus release gates "
            "(vsce publish, release-integrity, GitHub release)."
        )
    elif repo_type in {"web-app", "website-static"}:
        profile = (
            "Profile=web: hard admin gates "
            "(commit/push/PR/CI/merge) and strict docs-drift checks."
        )
    elif repo_type == "infra-automation":
        profile = (
            "Profile=infra-automation: hard admin gates "
            "and governance checks before merge."
        )
    else:
        profile = (
            "Profile=generic: hard admin gates "
            "(commit/push/PR/CI/merge) for code-changing sessions."
        )

    baton_msg = baton_protocol()
    standards_msg = governance_enforcement()
    postmerge_msg = post_merge_checklist()
    context_parts = [
        baton_msg, standards_msg,
        f"Project type: {repo_type}.", profile,
        f"Signals: {', '.join(signals) if signals else 'none'}.",
    ]
    if gaps:
        context_parts.append(f"Health gaps: {', '.join(gaps)}.")
    context_parts.append(postmerge_msg)

    out = {
        "hookSpecificOutput": {
            "hookEventName": "SessionStart",
            "additionalContext": " ".join(context_parts),
        }
    }
    print(json.dumps(out))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
