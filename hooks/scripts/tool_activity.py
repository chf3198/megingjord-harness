#!/usr/bin/env python3
"""Tool activity tracking for governance state."""
from __future__ import annotations

import re
from typing import Any

from baton_event_emitter import emit_role_handoff
from admin_patterns import (
    RE_GH_ISSUE_CLOSE, RE_GH_ISSUE_CREATE, RE_GH_RELEASE_CREATE,
    RE_GIT_COMMIT, RE_GIT_PUSH, RE_PR_CHECKS, RE_PR_CREATE,
    RE_PR_MERGE, RE_RELEASE_INTEGRITY, RE_VSCE_PUBLISH, RE_VSCE_SHOW,
    iter_strings, required_admin_ops,
)
from repo_detection import classify_path

PATCH_FILE_RE = re.compile(
    r"^\*\*\*\s+(?:Update|Add|Delete)\s+File:\s+(.+?)\s*$", re.MULTILINE
)
# Baton artifact names to detect in Bash inputs (gh issue comment bodies).
_BATON_ARTIFACT_RE = re.compile(
    r"\b(MANAGER_HANDOFF|COLLABORATOR_HANDOFF|ADMIN_HANDOFF|CONSULTANT_CLOSEOUT)\b"
)
_BATON_ROLE_MAP = {
    "MANAGER_HANDOFF": ("manager", "manager.handoff"),
    "COLLABORATOR_HANDOFF": ("collaborator", "collaborator.handoff"),
    "ADMIN_HANDOFF": ("admin", "admin.handoff"),
    "CONSULTANT_CLOSEOUT": ("consultant", "consultant.closeout"),
}
# Bash/terminal tools: inputs are shell commands, not file paths.
# Path classification is skipped for these to prevent false code_touched.
BASH_TOOLS = {"run_in_terminal", "terminal", "runTerminalCommand", "Bash", "run_command", "send_command_input"}


def mark_tool_activity(state: dict[str, Any], payload: dict[str, Any]) -> None:
    """Update governance state based on tool usage."""
    tool = str(payload.get("tool_name", ""))
    values = list(iter_strings(payload.get("tool_input", {})))
    joined = "\n".join(values)
    roles = state.setdefault("roles", {})
    flags = state.setdefault("flags", {})
    ops = state.setdefault("admin_ops", {})

    if tool in {
        "apply_patch", "create_file",
        "edit_notebook_file", "create_new_jupyter_notebook",
        "write_to_file", "replace_file_content", "multi_replace_file_content",
    }:
        roles["collaborator"] = True

    # #1960: Do not classify Bash command strings as file paths.
    # Only extract explicit patch-file names from Bash inputs.
    candidate_paths: list[str] = []
    if tool not in BASH_TOOLS:
        for value in values:
            candidate_paths.append(value)
            if "***" in value and "File:" in value:
                for m in PATCH_FILE_RE.findall(value):
                    candidate_paths.append(m.strip())
    else:
        for value in values:
            if "***" in value and "File:" in value:
                for m in PATCH_FILE_RE.findall(value):
                    candidate_paths.append(m.strip())

    for value in candidate_paths:
        if "/" not in value and "." not in value:
            continue
        kind = classify_path(value)
        if kind == "docs":
            flags["docs_touched"] = True
        elif kind == "extension":
            flags["extension_touched"] = True
            flags["code_touched"] = True
            roles["collaborator"] = True
        elif kind == "ui":  # #1817: scope visual_qa to actual UI paths
            flags["ui_touched"] = True
            flags["code_touched"] = True
            roles["collaborator"] = True
        elif kind == "code":
            flags["code_touched"] = True
            roles["collaborator"] = True

    if tool not in BASH_TOOLS:
        return

    _match_ops = [
        (RE_VSCE_SHOW, "version_check"),
        (RE_GIT_COMMIT, "commit"),
        (RE_GIT_PUSH, "push"),
        (RE_PR_CREATE, "pr_create"),
        (RE_PR_CHECKS, "ci_green"),
        (RE_PR_MERGE, "merge"),
        (RE_VSCE_PUBLISH, "publish"),
        (RE_RELEASE_INTEGRITY, "release_integrity"),
        (RE_GH_RELEASE_CREATE, "gh_release"),
        (RE_GH_ISSUE_CLOSE, "issue_close"),
        (RE_GH_ISSUE_CREATE, "issue_linked"),
    ]
    for pattern, key in _match_ops:
        if pattern.search(joined):
            ops[key] = True

    # #2444: auto-emit roles.admin once all required ops complete.
    # Mirrors check_admin_ops base/ext logic via shared helper.
    repo_type = state.get("repo_type", "generic")
    required = required_admin_ops(flags, repo_type)
    if required and all(ops.get(k) for k in required):
        if not roles.get("admin"):
            # #2457: emit baton-event on role transition
            try:
                import re as _re
                branch = state.get("active_branch") or ""
                m = _re.match(r"^[a-z]+/(\d+)-", branch)
                if m:
                    emit_role_handoff("collaborator", "admin", int(m.group(1)))
            except Exception:
                pass  # never break the gate on emitter failure
        roles["admin"] = True
    # #2918: detect baton artifact posts in Bash inputs and emit decision events
    if tool in BASH_TOOLS:
        artifact_match = _BATON_ARTIFACT_RE.search(joined)
        if artifact_match:
            artifact_name = artifact_match.group(1)
            role, decision_type = _BATON_ROLE_MAP.get(
                artifact_name, ("unknown", "baton.artifact")
            )
            try:
                from baton_event_emitter import emit_decision
                ticket = state.get("active_ticket")
                emit_decision(role, decision_type, "posted", ticket=ticket,
                              input_summary=f"{artifact_name} posted on #{ticket}")
            except Exception:
                pass  # G6: never break activity tracking