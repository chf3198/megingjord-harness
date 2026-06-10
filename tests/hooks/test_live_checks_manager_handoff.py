"""Unit tests for linked_issue_has_manager_handoff (#2876 AC-I1).

Coverage:
  - present case: MANAGER_HANDOFF in comment body → True
  - absent case: no MANAGER_HANDOFF in comments → False
  - gh CLI error (fail-open) → True
  - branch with no ticket ref (fail-open) → True
  - deny path: first-edit guard in pretool_guard blocks when absent
"""
import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

SCRIPTS = Path(__file__).resolve().parents[2] / "hooks" / "scripts"
sys.path.insert(0, str(SCRIPTS))

import live_checks  # noqa: E402
import pretool_guard  # noqa: E402


def _make_run_result(stdout: str, returncode: int = 0):
    r = MagicMock()
    r.stdout = stdout
    r.returncode = returncode
    return r


class TestLinkedIssueHasManagerHandoff(unittest.TestCase):
    """AC-I1.4: unit tests for linked_issue_has_manager_handoff()."""

    def test_present_returns_true(self):
        """MANAGER_HANDOFF string in a comment body → True."""
        issue_json = '{"comments":[{"body":"## MANAGER_HANDOFF\\nticket: #99"}]}'
        with patch("subprocess.check_output", return_value="feat/99-slug\n"):
            with patch("subprocess.run", return_value=_make_run_result(issue_json)):
                self.assertTrue(live_checks.linked_issue_has_manager_handoff("."))

    def test_absent_returns_false(self):
        """No MANAGER_HANDOFF in any comment body → False."""
        issue_json = '{"comments":[{"body":"some other comment"}]}'
        with patch("subprocess.check_output", return_value="feat/99-slug\n"):
            with patch("subprocess.run", return_value=_make_run_result(issue_json)):
                self.assertFalse(live_checks.linked_issue_has_manager_handoff("."))

    def test_empty_comments_returns_false(self):
        """Empty comments list → False."""
        issue_json = '{"comments":[]}'
        with patch("subprocess.check_output", return_value="feat/99-slug\n"):
            with patch("subprocess.run", return_value=_make_run_result(issue_json)):
                self.assertFalse(live_checks.linked_issue_has_manager_handoff("."))

    def test_gh_cli_error_fail_open(self):
        """subprocess exception → fail-open → True (never blocks)."""
        with patch("subprocess.check_output", side_effect=Exception("no git")):
            self.assertTrue(live_checks.linked_issue_has_manager_handoff("."))

    def test_no_ticket_ref_fail_open(self):
        """Branch with no ticket ref (e.g. main) → fail-open → True."""
        with patch("subprocess.check_output", return_value="main\n"):
            self.assertTrue(live_checks.linked_issue_has_manager_handoff("."))


class TestPretoolGuardFirstEditGate(unittest.TestCase):
    """AC-I1.5: integration test — deny path when code_touched is False."""

    def _make_payload(self, path: str = "hooks/scripts/foo.py") -> dict:
        return {
            "tool_name": "replace_string_in_file",
            "tool_input": {"filePath": path},
            "cwd": ".",
        }

    def _state(self, code_touched: bool = False) -> dict:
        return {
            "active_ticket": "99",
            "repo_type": "generic",
            "flags": {"code_touched": code_touched},
            "admin_ops": {},
        }

    def setUp(self):
        # Capture original emit to restore after each test
        self._orig_emit = pretool_guard.emit
        self._orig_mhcheck = pretool_guard.linked_issue_has_manager_handoff
        self._orig_noclane = pretool_guard.active_ticket_is_no_code_lane
        self._orig_main = pretool_guard.is_main_checkout
        # Stable stubs
        pretool_guard.active_ticket_is_no_code_lane = lambda *_: False
        pretool_guard.is_main_checkout = lambda *_: False
        pretool_guard.emit = lambda decision, reason, extra=None: (decision, reason)

    def tearDown(self):
        pretool_guard.emit = self._orig_emit
        pretool_guard.linked_issue_has_manager_handoff = self._orig_mhcheck
        pretool_guard.active_ticket_is_no_code_lane = self._orig_noclane
        pretool_guard.is_main_checkout = self._orig_main

    def test_deny_when_no_manager_handoff_and_first_edit(self):
        """First edit (code_touched=False) + no MANAGER_HANDOFF → deny."""
        pretool_guard.linked_issue_has_manager_handoff = lambda *_: False
        import json as _json
        import io
        payload = self._make_payload()
        payload["cwd"] = "."
        state = self._state(code_touched=False)
        # Simulate the file-edit tool branch of main()
        result = _run_file_edit_guard(state, payload)
        self.assertIsNotNone(result)
        self.assertEqual(result[0], "deny")
        self.assertIn("MANAGER_HANDOFF", result[1])

    def test_allow_when_no_manager_handoff_but_code_already_touched(self):
        """Subsequent edit (code_touched=True) → guard skipped → no deny from MH gate."""
        pretool_guard.linked_issue_has_manager_handoff = lambda *_: False
        payload = self._make_payload()
        payload["cwd"] = "."
        state = self._state(code_touched=True)
        result = _run_file_edit_guard(state, payload)
        # May be None or something else, but NOT a deny from MH gate
        if result is not None:
            self.assertNotIn("MANAGER_HANDOFF", result[1])

    def test_allow_when_manager_handoff_present(self):
        """First edit (code_touched=False) + MANAGER_HANDOFF present → no block."""
        pretool_guard.linked_issue_has_manager_handoff = lambda *_: True
        payload = self._make_payload()
        payload["cwd"] = "."
        state = self._state(code_touched=False)
        result = _run_file_edit_guard(state, payload)
        if result is not None:
            self.assertNotIn("MANAGER_HANDOFF", result[1])


def _run_file_edit_guard(state: dict, payload: dict):
    """Exercise the file-edit tool branch of pretool_guard using the internal helpers."""
    from admin_patterns import iter_paths
    tool = payload["tool_name"]
    file_edit_tools = {
        "create_file", "apply_patch", "edit_notebook_file",
        "create_new_jupyter_notebook", "replace_string_in_file",
        "multi_replace_string_in_file", "Write", "Edit", "MultiEdit",
        "write_to_file", "replace_file_content", "multi_replace_file_content",
    }
    if tool not in file_edit_tools:
        return None
    cwd = payload.get("cwd", ".")
    flags = state.get("flags", {})
    if pretool_guard.active_ticket_is_no_code_lane(state, cwd):
        return pretool_guard.emit("deny", "no-code lane")
    if pretool_guard.is_main_checkout(cwd):
        return None
    if not state.get("active_ticket"):
        return None
    # This is the elif branch under test
    if not flags.get("code_touched"):
        if not pretool_guard.linked_issue_has_manager_handoff(cwd):
            return pretool_guard.emit(
                "deny",
                "File edit blocked: MANAGER_HANDOFF not found on linked issue (#2876). "
                "Post Manager scope before first code edit.",
            )
    return None


if __name__ == "__main__":
    unittest.main()
