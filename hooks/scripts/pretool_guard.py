#!/usr/bin/env python3
"""PreToolUse hook: pre-tool guards and admin sequencing gates."""
import json, re, subprocess, sys
from pathlib import Path
SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path: sys.path.insert(0, str(SCRIPT_DIR))
from admin_patterns import (  # noqa: E501
    DANGEROUS_CMD_RE, RE_GH_ISSUE_CLOSE, RE_GH_RELEASE_CREATE, RE_GIT_COMMIT,
    RE_GIT_PUSH, RE_GIT_TAG, RE_PR_CHECKS, RE_PR_CREATE, RE_PR_MERGE,
    RE_RELEASE_INTEGRITY, RE_VSCE_PUBLISH, SECRET_FILE_RE, iter_paths, iter_strings)
from canonical_main_enforcer import is_main_checkout, evaluate_path
from governance_state import ensure_state
from live_checks import ci_gate_status_stable, linked_issue_has_collab_handoff
from runtime_paths import runtime_hook_paths
RE_ISSUE_REF = re.compile(r"#\d+")
RE_BRANCH_TICKET = re.compile(r"^(feat|fix|hotfix)/(\d+)-")
RE_BRANCH_CREATE = re.compile(r"git\s+(?:checkout\s+-b|switch\s+-c)\s+(\S+)")
RE_BRANCH_SWITCH = re.compile(
    r"(?:(?:^|;|&&|\|\|)\s*)git\s+(?:switch|checkout)\s+(?!-[bcCq])([^\s-]\S*)",
    re.MULTILINE,
)
BRANCH_VALID = re.compile(r"^(feat|fix|hotfix)/\d+-|^(chore|skill)/[a-z0-9]|^main$|^develop$")
RE_PR_REF = re.compile(r"gh\s+pr\s+merge\s+(\S+)")
IT_OPS_MARKERS_RE = re.compile(r"\[it-ops\]|chore\(it-ops\)\s*:", re.IGNORECASE)
NO_CODE_ADMIN_RE = re.compile(
    r"\bgit\s+add\b|\bgit\s+commit\b|\bgit\s+push\b|"
    r"\bgh\s+pr\s+(?:create|merge)\b|\bnpm\s+run\s+deploy(?:[:\w-]*)?\b|"
    r"\bnpx\s+vsce\s+publish\b|\bgh\s+release\s+create\b",
    re.IGNORECASE,
)

def detect_it_ops_bypass(joined: str, env: dict | None = None) -> tuple[bool, str | None]:
    """#2142: IT-ops commit-gate bypass detector.

    Returns (True, marker) if any of the documented markers matches:
    - env var MEGINGJORD_IT_OPS=1
    - commit message contains [it-ops] literal
    - commit message uses chore(it-ops): Conventional-Commits type prefix
    Returns (False, None) otherwise.
    """
    import os
    env = env if env is not None else os.environ
    if env.get("MEGINGJORD_IT_OPS") == "1":
        return True, "env:MEGINGJORD_IT_OPS=1"
    if IT_OPS_MARKERS_RE.search(joined):
        return True, "commit-subject-marker"
    return False, None

def current_branch(cwd: str) -> str | None:
    try:
        res = subprocess.run(["git", "branch", "--show-current"], cwd=cwd,
                             check=False, capture_output=True, text=True)
        b = (res.stdout or "").strip()
        return b or None
    except Exception:
        return None

def emit(decision: str, reason: str, extra: str | None = None) -> int:
    hook = {"hookEventName":"PreToolUse","permissionDecision":decision,"permissionDecisionReason":reason}
    if extra: hook["additionalContext"] = extra
    print(json.dumps({"hookSpecificOutput": hook}))
    return 0

def _emit_it_bypass_telemetry(marker: str, cwd: str) -> None:
    """Refs #2351: best-effort IT-bypass usage telemetry. Never blocks the hook."""
    try:
        from it_bypass_emit import emit_bypass
        emit_bypass(marker, cwd)
    except Exception:
        pass  # telemetry failure must not affect hook decision

def _active_ticket_labels(state: dict, cwd: str) -> set[str]:
    ticket = state.get("active_ticket")
    if not ticket:
        return set()
    try:
        res = subprocess.run(
            ["gh", "issue", "view", str(ticket), "--json", "labels", "-q", ".labels[].name"],
            cwd=cwd, check=False, capture_output=True, text=True, timeout=20,
        )
        return {line.strip() for line in (res.stdout or "").splitlines() if line.strip()}
    except Exception:
        return set()

def active_ticket_is_no_code_lane(state: dict, cwd: str) -> bool:
    return "lane:no-code-remediation" in _active_ticket_labels(state, cwd)

RE_ADMIN_OVERRIDE = re.compile(r"(?:^|\s)--admin(?:[=\s]|$)")

def require_bypass_exception(joined: str, state: dict, cwd: str) -> bool:
    """True when this is an admin-OVERRIDE merge lacking the Epic #2517 exception (#2706).
    Fail-CLOSED: once the command is a confirmed override, if the exception cannot be
    verified (label backend error) require it (return True) rather than silently bypass -
    consistent with the unbreakable-chain invariant. The except never re-raises, so a guard
    bug yields a recoverable deny, not a crash/brick. Non-override commands short-circuit
    to False before any throwable call."""
    if not RE_ADMIN_OVERRIDE.search(joined):
        return False
    try:
        return "merge-bypass:admin-exception" not in _active_ticket_labels(state, cwd)
    except Exception:
        return True

def check_terminal(joined: str, state: dict, cwd: str) -> int | None:
    flags, ops = state.get("flags", {}), state.get("admin_ops", {})
    repo_type = state.get("repo_type", "generic")
    no_code_lane = active_ticket_is_no_code_lane(state, cwd)
    if no_code_lane and NO_CODE_ADMIN_RE.search(joined):
        return emit("deny", "No-code remediation lane is issue-only. Admin/implementation commands are blocked; re-route to lane:code-change.")
    if DANGEROUS_CMD_RE.search(joined): return emit("deny","Blocked dangerous terminal command.")
    if is_main_checkout(cwd):
        sw = RE_BRANCH_SWITCH.search(joined)
        if sw and sw.group(1) not in ("main", "master"):
            return emit("deny", f"Canonical-main read-only: branch switch to '{sw.group(1)}' from main checkout rejected (#2107). Use a worktree (devenv-ops-<team-or-ticket>/) instead.")
    m = RE_BRANCH_CREATE.search(joined)
    if m and not BRANCH_VALID.match(m.group(1)):
        return emit("deny",f"Branch '{m.group(1)}' violates naming. Use feat/<ticket#>-desc.")
    if any(marker in joined for marker in runtime_hook_paths()):
        return emit("ask","Hook script mutation detected. Manual approval required.","Review for policy weakening.")
    if RE_GIT_COMMIT.search(joined):
        bypass, marker = detect_it_ops_bypass(joined)
        if bypass:
            _emit_it_bypass_telemetry(marker, cwd)
            return emit("allow", f"IT-ops commit bypass (#2142): {marker}")
        if not RE_ISSUE_REF.search(joined):
            return emit("deny","Commit blocked: no issue ref (#N). Link a ticket first.")
        branch = current_branch(cwd)
        match = RE_BRANCH_TICKET.match(branch or "")
        if match:
            expected = f"#{match.group(2)}"
            refs = RE_ISSUE_REF.findall(joined)
            if expected not in refs:
                return emit("deny", f"Commit blocked: branch ticket {expected} must be referenced in commit message.")
            mismatched = sorted({ref for ref in refs if ref != expected})
            if mismatched:
                return emit("deny", f"Commit blocked: one branch = one ticket. Remove mismatched refs: {', '.join(mismatched)}")
    if RE_GIT_PUSH.search(joined) and not ops.get("commit"):
        return emit("deny","Push blocked: commit step first (Admin sequencing).")
    if RE_PR_MERGE.search(joined):
        override = require_bypass_exception(joined, state, cwd)
        if override:
            return emit("deny", "Admin-override merge blocked (#2706): record the Epic #2517 exception "
                        "FIRST - add the 'merge-bypass:admin-exception' label (or a BLOCKER_NOTE with "
                        "bypass_reason: + approver:), THEN re-run the override merge.")
        if not ops.get("pr_create"): return emit("deny","Merge blocked: PR creation not recorded.")
        pr_m = RE_PR_REF.search(joined)
        if pr_m:
            ci_state = ci_gate_status_stable(pr_m.group(1), cwd)
            if ci_state == "pending-only":
                return emit("deny", "Merge blocked: required CI checks are still pending. Wait and re-check status only.")
            if ci_state in {"failing", "unknown"}:
                return emit("deny", "Merge blocked: required CI checks are not fully green (live API check).")
        elif not pr_m and not ops.get("ci_green"):
            return emit("deny","Merge blocked: CI-green not recorded.")
    if RE_VSCE_PUBLISH.search(joined) and repo_type == "vscode-extension" and flags.get("extension_touched"):
        if not ops.get("merge"): return emit("deny","Publish blocked: merge not recorded.")
    if RE_GH_RELEASE_CREATE.search(joined) and repo_type == "vscode-extension" and flags.get("extension_touched"):
        if not ops.get("publish"): return emit("deny","Release blocked: publish not recorded.")
    if RE_GH_ISSUE_CLOSE.search(joined):
        if no_code_lane:
            dirty = subprocess.run(
                ["git", "status", "--porcelain"],
                cwd=cwd, check=False, capture_output=True, text=True,
            ).stdout.strip()
            if dirty:
                return emit("deny", "No-code remediation lane invalid: repository diff detected. Move ticket to lane:code-change before closeout.")
        if flags.get("code_touched") and not ops.get("merge"): return emit("deny","Issue close blocked: merge not recorded.")
        if repo_type == "vscode-extension" and flags.get("extension_touched") and not ops.get("release_integrity"):
            return emit("deny","Issue close blocked: integrity check not recorded.")
        if "gh issue edit" not in joined and "--remove-label" not in joined:
            return emit("ask","Issue close should normalize labels first.","Remove execution role labels before close.")
    if RE_PR_CREATE.search(joined) and not RE_GIT_COMMIT.search(joined) and not ops.get("commit"):
        if not linked_issue_has_collab_handoff(cwd):
            return emit("deny","PR creation blocked: COLLABORATOR_HANDOFF not found on linked issue.")
        return emit("ask","PR creation before commit. Confirm intentional.")
    if RE_PR_CHECKS.search(joined) and not ops.get("pr_create"):
        return emit("ask","CI checks before PR creation. Confirm intentional.")
    if RE_RELEASE_INTEGRITY.search(joined) and repo_type == "vscode-extension" and not ops.get("publish"):
        return emit("ask","Integrity check before publish. Confirm intentional.")
    if RE_GIT_TAG.search(joined) and flags.get("ui_touched") and not ops.get("visual_qa"):
        return emit("deny","Tag blocked: visual QA not recorded for UI change.")
    return None

def main() -> int:
    try: payload = json.load(sys.stdin)
    except Exception: return 0
    tool = str(payload.get("tool_name",""))
    values = list(iter_strings(payload.get("tool_input",{})))
    cwd = str(payload.get("cwd","")) or str(Path.cwd())
    state = ensure_state(cwd)
    from state_store import reset_on_branch_change
    state = reset_on_branch_change(cwd, current_branch(cwd))
    if tool in {"create_file","apply_patch","edit_notebook_file","create_new_jupyter_notebook","replace_string_in_file","multi_replace_string_in_file","Write","Edit","MultiEdit","write_to_file","replace_file_content","multi_replace_file_content"}:
        if active_ticket_is_no_code_lane(state, cwd):
            return emit("deny", "File edit blocked: lane:no-code-remediation is issue-only. Re-route ticket to lane:code-change.")
        if is_main_checkout(cwd):
            for path_val in iter_paths(payload.get("tool_input", {})):
                if not (path_val.startswith("/") or path_val.startswith("./") or "/" in path_val):
                    continue
                allowed, reason = evaluate_path(path_val, cwd)
                if not allowed:
                    return emit("deny", f"Canonical-main read-only (#2107): {reason}")
        if not state.get("active_ticket"):
            from worktree_ticket import resolve_ticket_from_paths, any_path_in_governed_repo
            edit_paths = list(iter_paths(payload.get("tool_input", {})))
            # #2586: the gate keys on session cwd (main checkout); derive the real
            # active ticket from the edited file's worktree branch instead.
            # #2587: only gate paths that live inside a governed repo.
            derived = resolve_ticket_from_paths(edit_paths)
            gated = (not edit_paths) or any_path_in_governed_repo(edit_paths)
            if not derived and gated:
                return emit("deny","File edit blocked: no active ticket. Manager must reference a ticket (#N) before edits.")
    if tool in {"run_in_terminal","terminal","runTerminalCommand","Bash","run_command","send_command_input"}:
        # Refs #2235 — wire #2220 detector as ADVISORY (no deny; emit incident only).
        # Refs #2236 — when MEGINGJORD_FLEET_DIRECT_BLOCK=1, enforce DENY on fleet-bypass.
        try:
            from hamr_bypass_detector import detect_bypass, emit_incident
            from hamr_fleet_direct_block import should_block, block_message
            _det = detect_bypass("\n".join(values))
            emit_incident(_det)
            _blk = should_block(_det)
            if _blk.get("block"):
                return emit("deny", block_message(_det))
        except Exception:
            pass  # detector failure must not break pre-tool flow
        result = check_terminal("\n".join(values), state, cwd)
        if result is not None: return result
    suspicious = [v for v in values if "/" in v or "." in v]
    if any(SECRET_FILE_RE.search(p) and not p.endswith(".env.example") for p in suspicious):
        return emit("ask","Sensitive file path detected. Manual approval required.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
