#!/usr/bin/env python3
"""Tool activity tracking for governance state."""
from __future__ import annotations

import re
from typing import Any

from admin_patterns import (
    RE_GH_ISSUE_CLOSE, RE_GH_ISSUE_CREATE, RE_GH_RELEASE_CREATE,
    RE_GIT_COMMIT, RE_GIT_PUSH, RE_PR_CHECKS, RE_PR_CREATE,
    RE_PR_MERGE, RE_RELEASE_INTEGRITY, RE_VSCE_PUBLISH, RE_VSCE_SHOW,
    iter_strings,
)
from repo_detection import classify_path

PATCH_FILE_RE = re.compile(
    r"^\*\*\*\s+(?:Update|Add|Delete)\s+File:\s+(.+?)\s*$", re.MULTILINE
)


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
    }:
        roles["collaborator"] = True

    candidate_paths: list[str] = []
    for value in values:
        candidate_paths.append(value)
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
        elif kind == "code":
            flags["code_touched"] = True
            roles["collaborator"] = True

    if tool not in {"run_in_terminal", "terminal", "runTerminalCommand", "Bash"}:
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
