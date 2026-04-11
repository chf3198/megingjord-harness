#!/usr/bin/env python3
import json
import re
import sys
from pathlib import Path
from typing import Any, Iterable

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from governance_state import ensure_state

SECRET_FILE_RE = re.compile(r"(^|/)(\.env(\..*)?|id_rsa|id_ed25519|.*\.pem|.*\.key)$")
DANGEROUS_CMD_RE = re.compile(r"\brm\s+-rf\s+/(\s|$)|\bmkfs\b|\bdd\s+if=|\bDROP\s+TABLE\b", re.IGNORECASE)
GIT_COMMIT_RE = re.compile(r"\bgit\s+commit\b")
GIT_PUSH_RE = re.compile(r"\bgit\s+push\b")
PR_CREATE_RE = re.compile(r"\bgh\s+pr\s+create\b")
PR_CHECKS_RE = re.compile(r"\bgh\s+pr\s+checks\b")
PR_MERGE_RE = re.compile(r"\bgh\s+pr\s+merge\b")
VSCE_PUBLISH_RE = re.compile(r"\b(vsce\s+publish|npx\s+vsce\s+publish)\b")
RELEASE_INTEGRITY_RE = re.compile(r"release-integrity-check\.sh\s+--post-publish")
GH_RELEASE_CREATE_RE = re.compile(r"\bgh\s+release\s+create\b")
GH_ISSUE_CLOSE_RE = re.compile(r"\bgh\s+issue\s+close\b")


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
    cwd = str(payload.get("cwd", "")) or None

    state = ensure_state(cwd or str(Path.cwd()))
    flags = state.get("flags", {})
    ops = state.get("admin_ops", {})
    repo_type = state.get("repo_type", "generic")

    def emit(decision: str, reason: str, additional: str | None = None) -> int:
        out = {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": decision,
                "permissionDecisionReason": reason,
            }
        }
        if additional:
            out["hookSpecificOutput"]["additionalContext"] = additional
        print(json.dumps(out))
        return 0

    if tool in {"run_in_terminal", "terminal", "runTerminalCommand"}:
        joined = "\n".join(values)
        if DANGEROUS_CMD_RE.search(joined):
            return emit("deny", "Blocked dangerous terminal command by global policy.")

        # Block self-modifying hook changes unless explicitly approved.
        if ".copilot/hooks/scripts" in joined or "~/.copilot/hooks/scripts" in joined:
            return emit(
                "ask",
                "Hook-policy script mutation detected. Manual approval required.",
                "Review for policy weakening, self-approval paths, or hidden bypass logic.",
            )

        # Hard role-baton admin sequencing gates.
        if GIT_PUSH_RE.search(joined) and not ops.get("commit", False):
            return emit("deny", "Push blocked: run commit step first (Admin baton sequencing).")

        if PR_MERGE_RE.search(joined):
            if not ops.get("pr_create", False):
                return emit("deny", "Merge blocked: PR creation step not recorded.")
            if not ops.get("ci_green", False):
                return emit("deny", "Merge blocked: CI-green verification step not recorded.")

        if VSCE_PUBLISH_RE.search(joined):
            if repo_type == "vscode-extension" and flags.get("extension_touched", False):
                if not ops.get("merge", False):
                    return emit("deny", "Publish blocked: merge step not recorded.")

        if GH_RELEASE_CREATE_RE.search(joined):
            if repo_type == "vscode-extension" and flags.get("extension_touched", False):
                if not ops.get("publish", False):
                    return emit("deny", "Release blocked: extension publish step not recorded.")

        if GH_ISSUE_CLOSE_RE.search(joined):
            if flags.get("code_touched", False) and not ops.get("merge", False):
                return emit("deny", "Issue close blocked: merge step not recorded.")
            if repo_type == "vscode-extension" and flags.get("extension_touched", False):
                if not ops.get("release_integrity", False):
                    return emit("deny", "Issue close blocked: post-publish release integrity check not recorded.")

        # Encourage the right next step with ask-mode when sequencing is likely off.
        if PR_CREATE_RE.search(joined) and not GIT_COMMIT_RE.search(joined) and not ops.get("commit", False):
            return emit("ask", "PR creation before commit detected. Confirm this is intentional.")
        if PR_CHECKS_RE.search(joined) and not ops.get("pr_create", False):
            return emit("ask", "CI checks requested before PR creation was recorded. Confirm this is intentional.")
        if RELEASE_INTEGRITY_RE.search(joined) and repo_type == "vscode-extension" and not ops.get("publish", False):
            return emit("ask", "Post-publish integrity check requested before publish was recorded. Confirm this is intentional.")

    suspicious_paths = [v for v in values if "/" in v or "." in v]
    if any(SECRET_FILE_RE.search(p) and not p.endswith(".env.example") for p in suspicious_paths):
        return emit(
            "ask",
            "Sensitive file path detected (.env/key material). Manual approval required.",
            "Use secret-safe patterns and avoid committing or packaging sensitive files.",
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
