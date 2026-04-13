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


SECRET_FILE_RE = re.compile(
    r"(^|/)(\.env(\..*)?|id_rsa|id_ed25519|.*\.pem|.*\.key)$"
)
DANGEROUS_CMD_RE = re.compile(
    r"\brm\s+-rf\s+/(\s|$)|\bmkfs\b|\bdd\s+if=|\bDROP\s+TABLE\b",
    re.IGNORECASE,
)

RE_GIT_COMMIT = re.compile(r"\bgit\s+commit\b")
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
