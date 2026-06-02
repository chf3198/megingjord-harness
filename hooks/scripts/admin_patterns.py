#!/usr/bin/env python3
"""Shared regex patterns and utility functions for hook scripts."""
from __future__ import annotations

import re
from typing import Any, Iterable


def iter_strings(value: Any) -> Iterable[str]:
    """Recursively yield all string values from nested dicts/lists."""
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for v in value.values():
            yield from iter_strings(v)
    elif isinstance(value, list):
        for v in value:
            yield from iter_strings(v)


_PATH_PARAM_KEYS = frozenset({
    "file_path", "filePath", "path", "target_file", "destination",
    "notebook_path", "notebookPath",
    "TargetFile", "targetFile",  # Antigravity write_to_file/replace_file_content (#2585)
})
_COLLECTION_KEYS = frozenset({"replacements", "items"})


def iter_paths(tool_input: Any) -> Iterable[str]:
    """Yield only path-type parameter values from tool input.

    Reads known path-key names (file_path, filePath, etc.) but skips content
    fields like new_string/old_string to prevent false-positive path denials
    when content happens to contain path-like substrings. Refs #2371 AC1.
    """
    if not isinstance(tool_input, dict):
        return
    for k, v in tool_input.items():
        if k in _PATH_PARAM_KEYS and isinstance(v, str):
            yield v
        elif k in _COLLECTION_KEYS and isinstance(v, list):
            for item in v:
                if isinstance(item, dict):
                    for pk in _PATH_PARAM_KEYS:
                        if pk in item and isinstance(item[pk], str):
                            yield item[pk]


SECRET_FILE_RE = re.compile(
    r"(^|/)(\.env(\..*)?|id_rsa|id_ed25519|.*\.pem|.*\.key)$"
)
DANGEROUS_CMD_RE = re.compile(
    r"\brm\s+-rf\s+/(\s|$)|\bmkfs\b|\bdd\s+if=|\bDROP\s+TABLE\b",
    re.IGNORECASE,
)

RE_GIT_COMMIT = re.compile(r"\bgit\s+(?:-c\s+\S+\s+)*commit\b")
RE_GIT_PUSH = re.compile(r"\bgit\s+push\b")
RE_PR_CREATE = re.compile(r"\bgh\s+pr\s+create\b")
RE_PR_CHECKS = re.compile(r"\bgh\s+pr\s+checks\b")
RE_PR_MERGE = re.compile(r"\bgh\s+pr\s+merge\b")
RE_VSCE_SHOW = re.compile(r"\b(vsce\s+show|npx\s+vsce\s+show)\b")
RE_VSCE_PUBLISH = re.compile(r"\b(vsce\s+publish|npx\s+vsce\s+publish)\b")
RE_RELEASE_INTEGRITY = re.compile(
    r"release-integrity-check\.sh\s+--post-publish"
)
RE_GH_RELEASE_CREATE = re.compile(r"\bgh\s+release\s+create\b")
RE_GH_ISSUE_CLOSE = re.compile(r"\bgh\s+issue\s+close\b")
RE_GH_ISSUE_CREATE = re.compile(r"\bgh\s+issue\s+create\b")
RE_GIT_TAG = re.compile(r"\bgit\s+tag\b")


def required_admin_ops(flags: dict, repo_type: str) -> list[str]:
    """Admin op keys required for completion. Stays in sync with
    stop_checks.check_admin_ops base/ext logic (#2444).
    """
    base = (["commit", "push", "pr_create", "ci_green", "merge"]
            if flags.get("code_touched") else [])
    ext: list[str] = []
    if repo_type == "vscode-extension" and flags.get("extension_touched"):
        ext = ["publish", "release_integrity", "gh_release"]
    if flags.get("ui_touched"):
        ext.append("visual_qa")
    return base + ext
