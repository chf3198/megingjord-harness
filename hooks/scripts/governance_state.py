#!/usr/bin/env python3
"""Shared governance state helpers for Copilot hook scripts.

This module tracks project-type adaptive governance progress across hook events.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
from pathlib import Path
from typing import Any, Iterable


STATE_ROOT = Path.home() / ".copilot" / "hooks" / "state"


DOC_EXTS = {".md", ".rst", ".adoc"}
CODE_EXTS = {".sh", ".bash", ".js", ".ts", ".py", ".go", ".rs", ".java", ".c", ".cpp", ".json", ".yml", ".yaml", ".toml"}


def iter_strings(value: Any) -> Iterable[str]:
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for v in value.values():
            yield from iter_strings(v)
    elif isinstance(value, list):
        for v in value:
            yield from iter_strings(v)


def _repo_key(cwd: str) -> str:
    return hashlib.sha1(cwd.encode("utf-8")).hexdigest()[:16]


def state_path(cwd: str) -> Path:
    return STATE_ROOT / f"repo-{_repo_key(cwd)}.json"


def detect_repo_type(cwd: str) -> str:
    p = Path(cwd)

    if (p / "vscode-extension" / "package.json").exists() or (p / "mem-watchdog.sh").exists():
        return "vscode-extension"

    package_json = p / "package.json"
    if package_json.exists():
        try:
            pkg = json.loads(package_json.read_text(encoding="utf-8"))
        except Exception:
            pkg = {}

        deps = {
            **(pkg.get("dependencies") or {}),
            **(pkg.get("devDependencies") or {}),
        }
        dep_keys = {str(k).lower() for k in deps.keys()}
        if any(k in dep_keys for k in ("react", "next", "vue", "svelte", "@angular/core")):
            return "web-app"
        if pkg.get("engines", {}).get("vscode"):
            return "vscode-extension"
        return "library-sdk"

    has_workflows = (p / ".github" / "workflows").exists()
    has_many_shell = len(list(p.glob("**/*.sh"))) >= 3
    if has_workflows and has_many_shell:
        return "infra-automation"

    has_html = any(p.glob("**/*.html"))
    has_css = any(p.glob("**/*.css"))
    if has_html and has_css:
        return "website-static"

    return "generic"


def _default_state(cwd: str) -> dict[str, Any]:
    repo_type = detect_repo_type(cwd)
    return {
        "cwd": cwd,
        "repo_type": repo_type,
        "roles": {
            "manager": False,
            "collaborator": False,
            "admin": False,
            "consultant": False,
        },
        "flags": {
            "code_touched": False,
            "docs_touched": False,
            "extension_touched": False,
        },
        "admin_ops": {
            "version_check": False,
            "commit": False,
            "push": False,
            "pr_create": False,
            "ci_green": False,
            "merge": False,
            "publish": False,
            "release_integrity": False,
            "gh_release": False,
            "issue_close": False,
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
        data.setdefault("cwd", cwd)
        data.setdefault("repo_type", detect_repo_type(cwd))
        data.setdefault("roles", _default_state(cwd)["roles"])
        data.setdefault("flags", _default_state(cwd)["flags"])
        data.setdefault("admin_ops", _default_state(cwd)["admin_ops"])
        return data
    except Exception:
        return _default_state(cwd)


def save_state(state: dict[str, Any]) -> None:
    cwd = str(state.get("cwd") or os.getcwd())
    path = state_path(cwd)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, indent=2, sort_keys=True), encoding="utf-8")


def ensure_state(cwd: str) -> dict[str, Any]:
    state = load_state(cwd)
    if state.get("cwd") != cwd:
        state = _default_state(cwd)
    # Keep repo type fresh for parent-folder opens.
    state["repo_type"] = detect_repo_type(cwd)
    save_state(state)
    return state


def reset_state(cwd: str) -> dict[str, Any]:
    state = _default_state(cwd)
    save_state(state)
    return state


def classify_path(path: str) -> str:
    lp = path.lower()
    ext = Path(lp).suffix
    if "/docs/" in lp or lp.endswith("readme.md") or lp.endswith("changelog.md") or ext in DOC_EXTS:
        return "docs"
    if lp.startswith("vscode-extension/") or "/vscode-extension/" in lp:
        return "extension"
    if ext in CODE_EXTS:
        return "code"
    return "other"


RE_GIT_COMMIT = re.compile(r"\bgit\s+commit\b")
RE_GIT_PUSH = re.compile(r"\bgit\s+push\b")
RE_PR_CREATE = re.compile(r"\bgh\s+pr\s+create\b")
RE_PR_CHECKS = re.compile(r"\bgh\s+pr\s+checks\b")
RE_PR_MERGE = re.compile(r"\bgh\s+pr\s+merge\b")
RE_VSCE_SHOW = re.compile(r"\b(vsce\s+show|npx\s+vsce\s+show)\b")
RE_VSCE_PUBLISH = re.compile(r"\b(vsce\s+publish|npx\s+vsce\s+publish)\b")
RE_RELEASE_INTEGRITY = re.compile(r"release-integrity-check\.sh\s+--post-publish")
RE_GH_RELEASE_CREATE = re.compile(r"\bgh\s+release\s+create\b")
RE_GH_ISSUE_CLOSE = re.compile(r"\bgh\s+issue\s+close\b")
PATCH_FILE_RE = re.compile(r"^\*\*\*\s+(?:Update|Add|Delete)\s+File:\s+(.+?)\s*$", re.MULTILINE)


def mark_tool_activity(state: dict[str, Any], payload: dict[str, Any]) -> None:
    tool = str(payload.get("tool_name", ""))
    values = list(iter_strings(payload.get("tool_input", {})))
    joined = "\n".join(values)

    roles = state.setdefault("roles", {})
    flags = state.setdefault("flags", {})
    ops = state.setdefault("admin_ops", {})

    # Once tools are being used, planning/manager phase has happened.
    roles["manager"] = True

    if tool in {"apply_patch", "create_file", "edit_notebook_file", "create_new_jupyter_notebook"}:
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

    if tool in {"run_in_terminal", "terminal", "runTerminalCommand"}:
        if RE_VSCE_SHOW.search(joined):
            ops["version_check"] = True
        if RE_GIT_COMMIT.search(joined):
            ops["commit"] = True
        if RE_GIT_PUSH.search(joined):
            ops["push"] = True
        if RE_PR_CREATE.search(joined):
            ops["pr_create"] = True
        if RE_PR_CHECKS.search(joined):
            ops["ci_green"] = True
        if RE_PR_MERGE.search(joined):
            ops["merge"] = True
        if RE_VSCE_PUBLISH.search(joined):
            ops["publish"] = True
        if RE_RELEASE_INTEGRITY.search(joined):
            ops["release_integrity"] = True
        if RE_GH_RELEASE_CREATE.search(joined):
            ops["gh_release"] = True
        if RE_GH_ISSUE_CLOSE.search(joined):
            ops["issue_close"] = True

    base_ops_done = all(ops.get(k, False) for k in ("commit", "push", "pr_create", "ci_green", "merge"))
    if not flags.get("code_touched", False):
        base_ops_done = True

    if state.get("repo_type") == "vscode-extension" and flags.get("extension_touched", False):
        ext_done = all(ops.get(k, False) for k in ("publish", "release_integrity", "gh_release"))
    else:
        ext_done = True

    roles["admin"] = base_ops_done and ext_done
