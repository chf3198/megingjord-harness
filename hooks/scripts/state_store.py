#!/usr/bin/env python3
"""Governance state persistence: load, save, ensure, reset."""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from typing import Any

from repo_detection import detect_repo_type

STATE_ROOT = Path.home() / ".copilot" / "hooks" / "state"


def _repo_key(cwd: str) -> str:
    return hashlib.sha1(cwd.encode("utf-8")).hexdigest()[:16]


def state_path(cwd: str) -> Path:
    return STATE_ROOT / f"repo-{_repo_key(cwd)}.json"


def _default_state(cwd: str) -> dict[str, Any]:
    return {
        "cwd": cwd,
        "repo_type": detect_repo_type(cwd),
        "roles": {
            "manager": False, "collaborator": False,
            "admin": False, "consultant": False,
        },
        "flags": {
            "code_touched": False, "docs_touched": False,
            "extension_touched": False,
        },
        "admin_ops": {
            "version_check": False, "commit": False,
            "push": False, "pr_create": False,
            "ci_green": False, "merge": False,
            "publish": False, "release_integrity": False,
            "gh_release": False, "issue_close": False,
        },
    }


def load_state(cwd: str) -> dict[str, Any]:
    path = state_path(cwd)
    if not path.exists():
        return _default_state(cwd)
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            return _default_state(cwd)
        defaults = _default_state(cwd)
        data.setdefault("cwd", cwd)
        data.setdefault("repo_type", detect_repo_type(cwd))
        for key in ("roles", "flags", "admin_ops"):
            data.setdefault(key, defaults[key])
        return data
    except Exception:
        return _default_state(cwd)


def save_state(state: dict[str, Any]) -> None:
    cwd = str(state.get("cwd") or os.getcwd())
    path = state_path(cwd)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(state, indent=2, sort_keys=True), encoding="utf-8"
    )


def ensure_state(cwd: str) -> dict[str, Any]:
    state = load_state(cwd)
    if state.get("cwd") != cwd:
        state = _default_state(cwd)
    state["repo_type"] = detect_repo_type(cwd)
    save_state(state)
    return state


def reset_state(cwd: str) -> dict[str, Any]:
    state = _default_state(cwd)
    save_state(state)
    return state
