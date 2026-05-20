"""Guardrail tests for #1798 (T1-T6 from audit).

Covers phase-aware Stop hook + Manager-gate hardening + current_phase field.
Run via: python3 -m unittest tests/hooks/test_baton_phase_aware.py
"""
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

REPO_ROOT = Path(__file__).resolve().parents[2]
HOOKS_SCRIPTS = REPO_ROOT / "hooks" / "scripts"
sys.path.insert(0, str(HOOKS_SCRIPTS))

import manager_ticket_gate  # noqa: E402
import state_store  # noqa: E402
import stop_checks  # noqa: E402
import userprompt_gate  # noqa: E402


class StopChecksPhaseGuard(unittest.TestCase):
    """T1, T2, T3 — Stop-hook Admin warnings honor baton phase."""

    def test_t1_check_uncommitted_silent_pre_collab(self):
        roles = {"manager": True, "collaborator": False, "admin": False, "consultant": False}
        result = stop_checks.check_uncommitted(["issues.json", "filter.py"], roles)
        self.assertEqual(result, (None, None))

    def test_t2_check_uncommitted_fires_post_collab(self):
        roles = {"manager": True, "collaborator": True, "admin": False, "consultant": False}
        block_reason, msg = stop_checks.check_uncommitted(["script.js"], roles)
        self.assertIsNotNone(block_reason)
        self.assertIn("ADMIN ROLE INCOMPLETE", msg)

    def test_t2b_check_uncommitted_backward_compat_no_roles(self):
        # When roles is None (legacy callers), preserve original behavior — fire.
        block_reason, msg = stop_checks.check_uncommitted(["script.js"], None)
        self.assertIsNotNone(block_reason)

    def test_t3_check_admin_ops_silent_pre_collab(self):
        flags = {"code_touched": True}
        ops = {"commit": False, "push": False, "pr_create": False, "ci_green": False, "merge": False}
        roles = {"manager": True, "collaborator": False, "admin": False, "consultant": False}
        result = stop_checks.check_admin_ops(flags, ops, roles, "generic")
        self.assertEqual(result, (None, None))

    def test_t3b_check_admin_ops_fires_post_collab_missing(self):
        flags = {"code_touched": True}
        ops = {"commit": False, "push": False, "pr_create": False, "ci_green": False, "merge": False}
        roles = {"manager": True, "collaborator": True, "admin": False, "consultant": False}
        block_reason, msg = stop_checks.check_admin_ops(flags, ops, roles, "generic")
        self.assertIsNotNone(block_reason)
        self.assertIn("missing Admin steps", block_reason)


class ManagerGateHardening(unittest.TestCase):
    """T4, T5, T6 — Manager-gate respects state and ignores word noise."""

    def _run_gate(self, prompt, state_overrides=None):
        import io
        payload = {"prompt": prompt, "cwd": str(REPO_ROOT)}
        stdin_io = io.StringIO(json.dumps(payload))
        stdout_io = io.StringIO()
        base_state = {"roles": {}, "active_ticket": None}
        if state_overrides:
            base_state.update(state_overrides)
        with patch("manager_ticket_gate.is_repo_enabled", return_value=True), \
             patch("manager_ticket_gate.ensure_state", return_value=base_state), \
             patch("manager_ticket_gate.save_state"), \
             patch("sys.stdin", stdin_io), \
             patch("sys.stdout", stdout_io):
            manager_ticket_gate.main()
        out = stdout_io.getvalue().strip()
        return [out] if out else []

    def test_t4_no_trigger_on_word_work(self):
        captured = self._run_gate("What needs work next?")
        self.assertEqual(captured, [])

    def test_t4b_no_trigger_on_word_task(self):
        captured = self._run_gate("My next task is something")
        self.assertEqual(captured, [])

    def test_t5_accepts_active_ticket_from_state(self):
        captured = self._run_gate("MANAGER_HANDOFF: scope: foo", state_overrides={"active_ticket": 1798})
        self.assertEqual(captured, [])

    def test_t6_emits_on_explicit_handoff_without_ticket(self):
        captured = self._run_gate("MANAGER_HANDOFF: scope: bar")
        self.assertEqual(len(captured), 1)
        payload = json.loads(captured[0])
        self.assertIn("hookSpecificOutput", payload)


class CurrentPhaseField(unittest.TestCase):
    """F4 — governance state carries current_phase field."""

    def test_default_state_has_current_phase_manager(self):
        state = state_store._default_state(str(REPO_ROOT))
        self.assertEqual(state.get("current_phase"), "manager")

    def test_load_state_backfills_current_phase_for_legacy(self):
        # Simulate legacy state file without current_phase.
        # ensure_state writes defaults including current_phase.
        state = state_store.ensure_state(str(REPO_ROOT))
        self.assertIn("current_phase", state)


class UiTouchedScoping(unittest.TestCase):
    """#1817 — visual_qa requirement scoped to actual UI path changes."""

    def test_classify_path_ui_for_dashboard(self):
        from repo_detection import classify_path
        self.assertEqual(classify_path("dashboard/js/foo.js"), "ui")
        self.assertEqual(classify_path("dashboard/index.html"), "ui")
        self.assertEqual(classify_path("dashboard/css/main.css"), "ui")

    def test_classify_path_code_for_test_specs(self):
        from repo_detection import classify_path
        self.assertEqual(classify_path("tests/routing-policy.spec.js"), "code")
        self.assertEqual(classify_path("tests/batch-route.spec.js"), "code")
        self.assertEqual(classify_path("tests/ide-proxy-runtime.spec.js"), "code")

    def test_classify_path_code_for_scripts(self):
        from repo_detection import classify_path
        self.assertEqual(classify_path("scripts/global/foo.js"), "code")
        self.assertEqual(classify_path("hooks/scripts/bar.py"), "code")

    def test_check_admin_ops_no_visual_qa_when_only_code_touched(self):
        # Reproduces the Copilot Team screenshot: editing test specs in a web-app-classified repo.
        flags = {"code_touched": True, "ui_touched": False}
        ops = {"commit": True, "push": True, "pr_create": True, "ci_green": True, "merge": True, "visual_qa": False}
        roles = {"collaborator": True, "admin": True}
        result = stop_checks.check_admin_ops(flags, ops, roles, "website-static")
        self.assertEqual(result, (None, None), "visual_qa should NOT be required for non-UI code changes")

    def test_check_admin_ops_visual_qa_required_when_ui_touched(self):
        flags = {"code_touched": True, "ui_touched": True}
        ops = {"commit": True, "push": True, "pr_create": True, "ci_green": True, "merge": True, "visual_qa": False}
        roles = {"collaborator": True, "admin": True}
        block, msg = stop_checks.check_admin_ops(flags, ops, roles, "website-static")
        self.assertIsNotNone(block)
        self.assertIn("visual_qa", msg)


class UserPromptGatePhaseGuard(unittest.TestCase):
    """#1815 — userprompt_gate._admin_missing honors baton phase (Epic #1798 sibling)."""

    def test_admin_missing_silent_pre_collab_even_with_code_touched(self):
        # Reproduces the screenshot: prompt "Complete the work..." pre-collab.
        state = {
            "roles": {"manager": True, "collaborator": False, "admin": False, "consultant": False},
            "flags": {"code_touched": True},
            "admin_ops": {"commit": False, "push": False, "pr_create": False, "ci_green": False, "merge": False},
        }
        self.assertEqual(userprompt_gate._admin_missing(state), [])

    def test_admin_missing_fires_post_collab(self):
        state = {
            "roles": {"manager": True, "collaborator": True, "admin": False, "consultant": False},
            "flags": {"code_touched": True},
            "admin_ops": {"commit": False, "push": False, "pr_create": False, "ci_green": False, "merge": False},
        }
        missing = userprompt_gate._admin_missing(state)
        self.assertTrue(len(missing) > 0)
        self.assertIn("commit", missing)


import tool_activity  # noqa: E402


class ReadOnlySessionNoCodeTouched(unittest.TestCase):
    """#1960 — Bash read-only commands must NOT set code_touched (AC5/AC6)."""

    def _make_state(self):
        return {"roles": {}, "flags": {}, "admin_ops": {}}

    def test_readonly_bash_cat_does_not_set_code_touched(self):
        state = self._make_state()
        tool_activity.mark_tool_activity(state, {
            "tool_name": "Bash",
            "tool_input": {"command": "cat hooks/scripts/stop_reminder.py"},
        })
        self.assertFalse(state["flags"].get("code_touched", False))

    def test_readonly_bash_ls_does_not_set_code_touched(self):
        state = self._make_state()
        for cmd in ["ls -la scripts/global/", "git log --oneline -5",
                    "git status --porcelain", "gh issue view 1960",
                    "gh pr list", "gh label list", "tail -n 20 hooks/scripts/tool_activity.py",
                    "stat hooks/scripts/stop_reminder.py",
                    "cat hooks/scripts/git_checks.py",
                    "git diff HEAD~1 HEAD -- hooks/scripts/stop_checks.py"]:
            tool_activity.mark_tool_activity(state, {
                "tool_name": "Bash",
                "tool_input": {"command": cmd},
            })
        self.assertFalse(state["flags"].get("code_touched", False))
        self.assertFalse(state["roles"].get("collaborator", False))

    def test_create_file_sets_code_touched(self):
        # AC6: positive fixture — file-edit tool MUST set code_touched.
        state = self._make_state()
        tool_activity.mark_tool_activity(state, {
            "tool_name": "create_file",
            "tool_input": {"filePath": "hooks/scripts/new_helper.py", "content": "# test"},
        })
        self.assertTrue(state["flags"].get("code_touched", False))
        self.assertTrue(state["roles"].get("collaborator", False))

    def test_clean_tree_no_commit_skips_admin_check(self):
        # AC1: clean tree + no commit recorded → check_admin_ops returns None.
        flags = {"code_touched": True}
        ops = {}
        roles = {"collaborator": True}
        block, msg = stop_checks.check_admin_ops(flags, ops, roles, "generic", uncommitted=[])
        self.assertIsNone(block)
        self.assertIsNone(msg)

    def test_clean_tree_with_commit_still_checks_admin(self):
        # Positive: clean tree but commit recorded means push/PR still needed.
        flags = {"code_touched": True}
        ops = {"commit": True}
        roles = {"collaborator": True}
        block, msg = stop_checks.check_admin_ops(flags, ops, roles, "generic", uncommitted=[])
        self.assertIsNotNone(block)

    def test_dot_claude_settings_not_blocked(self):
        # AC4: .claude/ files excluded from uncommitted block.
        roles = {"collaborator": True}
        block, msg = stop_checks.check_uncommitted([".claude/settings.json"], roles)
        self.assertIsNone(block)
        self.assertIsNone(msg)


if __name__ == "__main__":
    unittest.main()
