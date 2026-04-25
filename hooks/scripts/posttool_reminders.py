#!/usr/bin/env python3
"""PostToolUse hook: governance reminders for docs/release hygiene."""
import json
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from admin_patterns import RE_GIT_COMMIT, RE_GIT_PUSH, iter_strings
from governance_state import ensure_state, mark_tool_activity, save_state
from wiki_wisdom import governance_enforcement, post_merge_checklist

DOC_TRIGGER_RE = re.compile(
    r"(^|/)(README\.md|CHANGELOG\.md|docs/|\.github/workflows/|"
    r"\.github/CONTRIBUTING\.md|\.github/PULL_REQUEST_TEMPLATE\.md|"
    r"package\.json|pyproject\.toml|Cargo\.toml|pom\.xml|\.vscodeignore)$"
)
CODE_TRIGGER_RE = re.compile(
    r"(^|/)(mem-watchdog\.sh|install\.sh|mem-watchdog\.service|"
    r"vscode-extension/.*\.(js|ts|json)|scripts/.*\.sh|tests/.*\.sh)$"
)


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return 0

    tool = str(payload.get("tool_name", ""))
    values = list(iter_strings(payload.get("tool_input", {})))
    joined = "\n".join(values)

    cwd = str(payload.get("cwd", "")) or str(Path.cwd())
    state = ensure_state(cwd)
    mark_tool_activity(state, payload)
    save_state(state)

    flags = state.get("flags", {})
    ops = state.get("admin_ops", {})
    repo_type = state.get("repo_type", "generic")
    messages = []

    if any(DOC_TRIGGER_RE.search(v) for v in values):
        messages.append(governance_enforcement())
    if any(CODE_TRIGGER_RE.search(v) for v in values):
        messages.append(
            "Doc coverage matrix: root README, extension README, "
            "CHANGELOG(s), design docs, contribution/governance docs."
        )

    if tool in {"run_in_terminal", "terminal", "runTerminalCommand", "Bash"}:
        if RE_GIT_PUSH.search(joined):
            messages.append(post_merge_checklist())
        elif RE_GIT_COMMIT.search(joined):
            messages.append(
                "Post-commit: if behavior/config changed, update docs "
                "in same commit or immediate follow-up."
            )

    if flags.get("code_touched"):
        if not state.get("roles", {}).get("manager"):
            messages.append(
                "Governance alert: code changes were made before Manager scope was recorded. "
                "Create or link an issue and perform Manager handoff."
            )
        missing = [k for k in ("commit", "push", "pr_create", "ci_green", "merge") if not ops.get(k)]
        if missing:
            messages.append(f"Admin baton incomplete — missing: {', '.join(missing)}.")
        if not ops.get("issue_linked"):
            messages.append(
                "Ticket gate: code was touched but no GitHub issue is linked. "
                "Run `gh issue create` or reference an existing issue."
            )

    if repo_type == "vscode-extension" and flags.get("extension_touched"):
        ext_missing = [k for k in ("publish", "release_integrity", "gh_release") if not ops.get(k)]
        if ext_missing:
            messages.append(f"Extension baton incomplete — missing: {', '.join(ext_missing)}.")

    if messages:
        print(json.dumps({
            "hookSpecificOutput": {
                "hookEventName": "PostToolUse",
                "additionalContext": " | ".join(messages),
            },
            "systemMessage": "Governance state updated; baton reminders injected.",
        }))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
