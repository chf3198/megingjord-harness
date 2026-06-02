"""No-code remediation lane deny rules (#2265)."""
import io
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

REPO_ROOT = Path(__file__).resolve().parents[2]
HOOKS_SCRIPTS = REPO_ROOT / "hooks" / "scripts"
sys.path.insert(0, str(HOOKS_SCRIPTS))

import pretool_guard  # noqa: E402


class NoCodeLaneGuards(unittest.TestCase):
    def test_denies_admin_command_in_no_code_lane(self):
        state = {"flags": {}, "admin_ops": {}, "repo_type": "generic", "active_ticket": 2265}
        out = {}

        def fake_emit(decision, reason, extra=None):
            out["decision"], out["reason"] = decision, reason
            return 0

        with patch("pretool_guard.active_ticket_is_no_code_lane", return_value=True), \
             patch("pretool_guard.emit", side_effect=fake_emit):
            pretool_guard.check_terminal("git commit -m 'x #2265'", state, str(REPO_ROOT))

        self.assertEqual(out.get("decision"), "deny")
        self.assertIn("issue-only", out.get("reason", ""))

    def test_denies_file_edit_tool_in_no_code_lane(self):
        payload = {
            "tool_name": "apply_patch",
            "tool_input": {"input": "*** Begin Patch\n*** End Patch"},
            "cwd": str(REPO_ROOT),
        }
        state = {"flags": {}, "admin_ops": {}, "repo_type": "generic", "active_ticket": 2265}
        out = {}

        def fake_emit(decision, reason, extra=None):
            out["decision"], out["reason"] = decision, reason
            return 0

        with patch("pretool_guard.ensure_state", return_value=state), \
             patch("pretool_guard.current_branch", return_value="fix/2265-no-code-lane"), \
             patch("pretool_guard.active_ticket_is_no_code_lane", return_value=True), \
             patch("pretool_guard.emit", side_effect=fake_emit), \
             patch("sys.stdin", io.StringIO(json.dumps(payload))):
            pretool_guard.main()

        self.assertEqual(out.get("decision"), "deny")
        self.assertIn("File edit blocked", out.get("reason", ""))

    def test_allows_issue_comment_command_in_no_code_lane(self):
        state = {"flags": {}, "admin_ops": {}, "repo_type": "generic", "active_ticket": 2265}
        with patch("pretool_guard.active_ticket_is_no_code_lane", return_value=True):
            self.assertIsNone(pretool_guard.check_terminal(
                "gh issue comment 2265 --body 'note'", state, str(REPO_ROOT)
            ))


if __name__ == "__main__":
    unittest.main()