#!/usr/bin/env python3
"""PreToolUse hook: pre-tool guards and admin sequencing gates."""
import json, re, sys
from pathlib import Path
SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path: sys.path.insert(0, str(SCRIPT_DIR))
from admin_patterns import (  # noqa: E501
    DANGEROUS_CMD_RE, RE_GH_ISSUE_CLOSE, RE_GH_RELEASE_CREATE, RE_GIT_COMMIT,
    RE_GIT_PUSH, RE_GIT_TAG, RE_PR_CHECKS, RE_PR_CREATE, RE_PR_MERGE,
    RE_RELEASE_INTEGRITY, RE_VSCE_PUBLISH, SECRET_FILE_RE, iter_strings)
from governance_state import ensure_state
RE_ISSUE_REF = re.compile(r"#\d+")

def emit(decision: str, reason: str, extra: str | None = None) -> int:
    hook = {"hookEventName":"PreToolUse","permissionDecision":decision,"permissionDecisionReason":reason}
    if extra: hook["additionalContext"] = extra
    print(json.dumps({"hookSpecificOutput": hook}))
    return 0

def check_terminal(joined: str, state: dict) -> int | None:
    flags, ops = state.get("flags", {}), state.get("admin_ops", {})
    repo_type = state.get("repo_type", "generic")
    if DANGEROUS_CMD_RE.search(joined): return emit("deny","Blocked dangerous terminal command.")
    if ".copilot/hooks/scripts" in joined:
        return emit("ask","Hook script mutation detected. Manual approval required.","Review for policy weakening or bypass logic.")
    if RE_GIT_COMMIT.search(joined) and not RE_ISSUE_REF.search(joined):
        return emit("ask","Commit has no issue ref (#N). Create/link issue first.")
    if RE_GIT_PUSH.search(joined) and not ops.get("commit"):
        return emit("deny","Push blocked: commit step first (Admin sequencing).")
    if RE_PR_MERGE.search(joined):
        if not ops.get("pr_create"): return emit("deny","Merge blocked: PR creation not recorded.")
        if not ops.get("ci_green"): return emit("deny","Merge blocked: CI-green not recorded.")
    if RE_VSCE_PUBLISH.search(joined) and repo_type == "vscode-extension" and flags.get("extension_touched"):
        if not ops.get("merge"): return emit("deny","Publish blocked: merge not recorded.")
    if RE_GH_RELEASE_CREATE.search(joined) and repo_type == "vscode-extension" and flags.get("extension_touched"):
        if not ops.get("publish"): return emit("deny","Release blocked: publish not recorded.")
    if RE_GH_ISSUE_CLOSE.search(joined):
        if flags.get("code_touched") and not ops.get("merge"): return emit("deny","Issue close blocked: merge not recorded.")
        if repo_type == "vscode-extension" and flags.get("extension_touched") and not ops.get("release_integrity"):
            return emit("deny","Issue close blocked: integrity check not recorded.")
    if RE_PR_CREATE.search(joined) and not RE_GIT_COMMIT.search(joined) and not ops.get("commit"):
        return emit("ask","PR creation before commit. Confirm intentional.")
    if RE_PR_CHECKS.search(joined) and not ops.get("pr_create"):
        return emit("ask","CI checks before PR creation. Confirm intentional.")
    if RE_RELEASE_INTEGRITY.search(joined) and repo_type == "vscode-extension" and not ops.get("publish"):
        return emit("ask","Integrity check before publish. Confirm intentional.")
    if RE_GIT_TAG.search(joined) and repo_type in ("website-static","web-app") and not ops.get("visual_qa"):
        return emit("deny","Tag blocked: visual QA not recorded for web repo.")
    return None

def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return 0
    tool = str(payload.get("tool_name",""))
    values = list(iter_strings(payload.get("tool_input",{})))
    cwd = str(payload.get("cwd","")) or str(Path.cwd())
    state = ensure_state(cwd)
    if tool in {"create_file","apply_patch","edit_notebook_file","create_new_jupyter_notebook","replace_string_in_file"}:
        if not state.get("roles", {}).get("manager"):
            return emit("deny","File edit blocked: Manager handoff required before editing repository files. Create and reference a ticket first.")
    if tool in {"run_in_terminal","terminal","runTerminalCommand"}:
        result = check_terminal("\n".join(values), state)
        if result is not None: return result
    suspicious = [v for v in values if "/" in v or "." in v]
    if any(SECRET_FILE_RE.search(p) and not p.endswith(".env.example") for p in suspicious):
        return emit("ask","Sensitive file path detected. Manual approval required.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
