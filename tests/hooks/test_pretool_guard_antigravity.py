"""Unit tests verifying Antigravity tool parity in pretool_guard and tool_activity."""
import sys
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock

REPO_ROOT = Path(__file__).resolve().parents[2]
HOOKS_SCRIPTS = REPO_ROOT / "hooks" / "scripts"
sys.path.insert(0, str(HOOKS_SCRIPTS))

import pretool_guard  # noqa: E402
import tool_activity  # noqa: E402


class AntigravityParity(unittest.TestCase):
    def test_pretool_guard_catches_antigravity_write(self):
        payload = {
            "tool_name": "write_to_file",
            "tool_input": {"TargetFile": "wiki/work-log/README.md"},
            "cwd": str(REPO_ROOT)
        }
        
        captured = {}
        def fake_emit(decision, reason, extra=None):
            captured["decision"] = decision
            captured["reason"] = reason
            return 0

        # With no active ticket, it should deny edits
        with patch("pretool_guard.emit", side_effect=fake_emit), \
             patch("pretool_guard.is_main_checkout", return_value=True), \
             patch("pretool_guard.ensure_state", return_value={}):
            
            with patch("sys.stdin") as mock_stdin:
                import json
                mock_stdin.read.return_value = json.dumps(payload)
                pretool_guard.main()
                
        self.assertEqual(captured.get("decision"), "deny")
        self.assertIn("Canonical-main read-only", captured.get("reason", ""))

    def test_tool_activity_registers_antigravity_tools(self):
        state = {}
        payload = {
            "tool_name": "replace_file_content",
            "tool_input": {"TargetFile": "wiki/work-log/README.md"}
        }
        tool_activity.mark_tool_activity(state, payload)
        self.assertTrue(state.get("roles", {}).get("collaborator"))

    def test_run_command_in_bash_tools(self):
        self.assertIn("run_command", tool_activity.BASH_TOOLS)
        self.assertIn("send_command_input", tool_activity.BASH_TOOLS)


if __name__ == "__main__":
    unittest.main()
