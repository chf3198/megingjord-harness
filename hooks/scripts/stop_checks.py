#!/usr/bin/env python3
"""Stop hook checking logic: admin completion and post-merge governance."""
from __future__ import annotations
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from admin_patterns import required_admin_ops
from wiki_wisdom import post_merge_checklist

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
    roles: dict | None = None,
) -> tuple[str | None, str | None]:
    if not uncommitted:
        return None, None
    # Phase guard (#1798 F1): pre-collab uncommitted state is in-progress or unrelated, not an Admin gap.
    if roles is not None and not roles.get("collaborator", False):
        return None, None
    # #1960: exclude harness-auto-managed paths (.claude/) from block.
    code_files = [
        f for f in uncommitted
        if any(f.endswith(e) for e in CODE_UNCOMMITTED_EXTS)
        and not f.startswith(".claude/")
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
    uncommitted: list[str] | None = None,
) -> tuple[str | None, str | None]:
    """Check admin op completion. Returns (block_reason, message)."""
    # Phase guard (#1798 F2): Admin ops only meaningful after Collaborator completes.
    if not roles.get("collaborator", False):
        return None, None
    # #1960: clean tree + no commit = code was reverted; AC#1 clean-tree pass.
    if uncommitted is not None and not uncommitted and not ops.get("commit"):
        return None, None
    required = required_admin_ops(flags, repo_type)
    missing = [k for k in required if not ops.get(k)]
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
    signals: list[str], has_messages: bool, ops: dict | None = None
) -> list[str]:
    # Completion guard (#2005 Gap 1): if merge op is confirmed, admin cycle is
    # done — suppress the checklist regardless of session signals.
    if ops and ops.get("merge"):
        return []
    if "code-changed" in signals or "extension-changed" in signals:
        return [post_merge_checklist()]
    if not has_messages:
        return ["Before ending: confirm checks/releases are evidence-backed and docs are synchronized."]
    return []


def wiki_pending_message(cwd: str, flags: dict, ops: dict) -> str | None:
    touched = any(flags.get(k) for k in ("code_touched", "docs_touched", "extension_touched"))
    if not touched or ops.get("issue_close"):
        return None
    if (Path(cwd) / "wiki" / "log.md").is_file():
        return ("WIKI PENDING — Significant work detected. Before session end, "
                "append wiki/log.md and update wiki/index.md if new pages were created.")
    from runtime_paths import wiki_candidates
    if any((c / "log.md").is_file() for c in wiki_candidates()):
        return ("WIKI PENDING (cross-repo) — Significant work detected. "
                "Update wiki/log.md and wiki/index.md in devenv-ops before session end.")
    return None
