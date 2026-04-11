#!/usr/bin/env python3
"""PostToolUse hook: governance reminders for docs/release hygiene.

Triggers:
1) Documentation file edits -> standards reminder
2) Code/config edits -> documentation coverage matrix reminder
3) Terminal git commit/push -> governance checklist reminder
"""
import json
import re
import sys
from pathlib import Path
from typing import Any, Iterable

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from governance_state import ensure_state, mark_tool_activity, save_state

DOC_TRIGGER_RE = re.compile(
    r"(^|/)(README\.md|CHANGELOG\.md|docs/|\.github/workflows/|"
    r"\.github/CONTRIBUTING\.md|\.github/PULL_REQUEST_TEMPLATE\.md|"
    r"package\.json|pyproject\.toml|Cargo\.toml|pom\.xml|\.vscodeignore)$"
)

CODE_TRIGGER_RE = re.compile(
    r"(^|/)(mem-watchdog\.sh|install\.sh|mem-watchdog\.service|"
    r"vscode-extension/.*\.(js|ts|json)|scripts/.*\.sh|tests/.*\.sh)$"
)

GIT_COMMIT_RE = re.compile(r"\bgit\s+commit\b")
GIT_PUSH_RE = re.compile(r"\bgit\s+push\b")


def iter_strings(value: Any) -> Iterable[str]:
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for v in value.values():
            yield from iter_strings(v)
    elif isinstance(value, list):
        for v in value:
            yield from iter_strings(v)


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return 0

    tool = str(payload.get("tool_name", ""))
    tool_input = payload.get("tool_input", {})
    values = list(iter_strings(tool_input))
    joined = "\n".join(values)

    cwd = str(payload.get("cwd", "")) or str(Path.cwd())
    state = ensure_state(cwd)
    mark_tool_activity(state, payload)
    save_state(state)

    flags = state.get("flags", {})
    ops = state.get("admin_ops", {})
    repo_type = state.get("repo_type", "generic")

    messages = []

    doc_triggered = any(DOC_TRIGGER_RE.search(v) for v in values)
    code_triggered = any(CODE_TRIGGER_RE.search(v) for v in values)

    if doc_triggered:
        messages.append(
            "Standards reminder: validate version integrity, run relevant checks, "
            "audit distributable artifacts for secret files, and sync docs to "
            "behavior/config changes."
        )

    if code_triggered:
        messages.append(
            "Doc coverage matrix reminder (required before feature completion): "
            "root README, extension README, CHANGELOG(s), design docs "
            "(docs/technical/system-stability.md), and contribution/governance docs "
            "(.github/CONTRIBUTING.md + PR template)."
        )

    if tool in {"run_in_terminal", "terminal", "runTerminalCommand"}:
        if GIT_PUSH_RE.search(joined):
            messages.append(
                "Pre-push governance gate: run scripts/docs-integrity-check.sh and verify "
                "README badge + copilot-instructions + CI comment + CONTRIBUTING + PR template "
                "test counts all match npm test output."
            )
        elif GIT_COMMIT_RE.search(joined):
            messages.append(
                "Post-commit governance check: if behavior/config changed, ensure local + public docs "
                "are updated in the same commit or an immediate follow-up before push."
            )

    # Adaptive role-baton next-step guidance (stateful).
    if flags.get("code_touched", False):
        base_missing = [k for k in ("commit", "push", "pr_create", "ci_green", "merge") if not ops.get(k, False)]
        if base_missing:
            messages.append(
                "Admin baton incomplete for code session — missing: "
                + ", ".join(base_missing)
                + "."
            )

    if repo_type == "vscode-extension" and flags.get("extension_touched", False):
        ext_missing = [k for k in ("publish", "release_integrity", "gh_release") if not ops.get(k, False)]
        if ext_missing:
            messages.append(
                "Extension release baton incomplete — missing: "
                + ", ".join(ext_missing)
                + "."
            )

    if messages:
        out = {
            "hookSpecificOutput": {
                "hookEventName": "PostToolUse",
                "additionalContext": " | ".join(messages),
            },
            "systemMessage": "Governance state updated; adaptive baton reminders injected.",
        }
        print(json.dumps(out))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
