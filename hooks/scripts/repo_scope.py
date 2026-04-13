#!/usr/bin/env python3
"""Repo scope controls for optional workflow enforcement."""
from __future__ import annotations

import json
from pathlib import Path

CONFIG_PATH = Path.home() / ".copilot" / "hooks" / "repo-scope.json"


def _norm(path: str) -> str:
    return str(Path(path).expanduser().resolve())


def is_repo_enabled(cwd: str) -> bool:
    try:
        data = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    except Exception:
        return False

    default_enabled = bool(data.get("default_enabled", False))
    enabled = data.get("enabled_repos", [])
    if not isinstance(enabled, list):
        return default_enabled

    cur = _norm(cwd)
    for item in enabled:
        if not isinstance(item, str):
            continue
        if _norm(item) == cur:
            return True
    return default_enabled
