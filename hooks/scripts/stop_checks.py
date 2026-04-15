#!/usr/bin/env python3
"""Stop hook checking logic: admin completion and post-merge governance."""
from __future__ import annotations
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from wiki_wisdom import admin_steps, post_merge_checklist

CODE_UNCOMMITTED_EXTS = (".sh", ".js", ".py", ".ts", ".json", ".md")

ADMIN_STEPS = (
    "  1. Version collision check\n"
    "  2. git add -A && git commit\n"
    "  3. git push -u origin <branch>\n"
    "  4. gh pr create with Closes #N\n"
    "  5. Wait for CI green\n"
    "  6. gh pr merge\n"
    "  7. If extension changed: npx vsce publish\n"
    "  8. release-integrity-check.sh --post-publish\n"
    "  9. gh release create vX.Y.Z\n"
    " 10. gh issue close N"
)


def check_uncommitted(
    uncommitted: list[str],
) -> tuple[str | None, str | None]:
    """Check for uncommitted code files. Returns (block_reason, message)."""
    if not uncommitted:
        return None, None
    code_files = [
        f for f in uncommitted
        if any(f.endswith(e) for e in CODE_UNCOMMITTED_EXTS)
    ]
    if not code_files:
        return None, None
    sample = code_files[:5]
    ellipsis = "..." if len(code_files) > 5 else ""
    msg = (
        f"ADMIN ROLE INCOMPLETE — uncommitted changes.\n"
        f"Files ({len(code_files)}): {', '.join(sample)}{ellipsis}\n"
        f"Admin role MUST complete:\n{ADMIN_STEPS}"
    )
    return "Stop blocked: uncommitted changes; Admin baton incomplete.", msg


def check_admin_ops(
    flags: dict, ops: dict, roles: dict, repo_type: str,
) -> tuple[str | None, str | None]:
    """Check admin op completion. Returns (block_reason, message)."""
    base = (
        ["commit", "push", "pr_create", "ci_green", "merge"]
        if flags.get("code_touched") else []
    )
    ext: list[str] = []
    if repo_type == "vscode-extension" and flags.get("extension_touched"):
        ext = ["publish", "release_integrity", "gh_release"]
    if repo_type in ("website-static", "web-app") and flags.get("code_touched"):
        ext.append("visual_qa")
    missing = [k for k in base + ext if not ops.get(k)]
    if missing:
        reason = f"Stop blocked: missing Admin steps ({', '.join(missing)})."
        return reason, f"Hard governance gate. Missing: {', '.join(missing)}."
    if flags.get("code_touched") and not roles.get("admin"):
        return (
            "Stop blocked: Admin role not complete for code session.",
            "Admin role not marked complete in governance state.",
        )
    return None, None


def post_merge_messages(
    signals: list[str], has_messages: bool,
) -> list[str]:
    """Generate post-merge governance checklist messages."""
    if "code-changed" in signals or "extension-changed" in signals:
        return [post_merge_checklist()]
    if not has_messages:
        return [
            "Before ending: confirm checks/releases are evidence-backed "
            "and docs are synchronized."
        ]
    return []
