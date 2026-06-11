"""Memory-write guard tests for pretool_guard (#2903, G-07)."""
import json
import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
HOOKS_SCRIPTS = REPO_ROOT / "hooks" / "scripts"
sys.path.insert(0, str(HOOKS_SCRIPTS))

import pretool_guard  # noqa: E402


def _run_main(tool: str, tool_input: dict) -> dict:
    """Run pretool_guard.main() against a synthetic payload, return parsed output."""
    import io
    from unittest.mock import patch

    payload = json.dumps({"tool_name": tool, "tool_input": tool_input, "cwd": str(REPO_ROOT)})
    captured = {}

    def capture_emit(decision, reason, extra=None):
        captured["decision"] = decision
        captured["reason"] = reason
        return 0

    fixed_state = {"flags": {}, "admin_ops": {}, "active_ticket": 99}
    with patch("pretool_guard.emit", side_effect=capture_emit), \
         patch("sys.stdin", io.StringIO(payload)), \
         patch("pretool_guard.ensure_state", return_value=fixed_state), \
         patch("state_store.reset_on_branch_change", return_value=fixed_state), \
         patch("pretool_guard.active_ticket_is_no_code_lane", return_value=False), \
         patch("pretool_guard.is_main_checkout", return_value=False), \
         patch("pretool_guard.linked_issue_has_manager_handoff", return_value=True):
        pretool_guard.main()

    return captured


class MemoryWriteGuardDeny(unittest.TestCase):
    """G-07 #2903: raw file writes to /memories/ must be denied."""

    def _assert_denied(self, tool: str, path: str):
        result = _run_main(tool, {"filePath": path, "content": "injected content"})
        self.assertEqual(result.get("decision"), "deny",
                         f"Expected deny for {tool} → {path}, got: {result}")
        self.assertIn("/memories/", result.get("reason", ""),
                      "Deny reason should mention /memories/")
        self.assertIn("#2903", result.get("reason", ""),
                      "Deny reason should reference ticket #2903")

    def test_create_file_session_memory_denied(self):
        self._assert_denied("create_file", "/memories/session/context.md")

    def test_create_file_user_memory_denied(self):
        self._assert_denied("create_file", "/memories/debugging.md")

    def test_write_tool_memories_denied(self):
        self._assert_denied("Write", "/memories/repo/notes.md")

    def test_replace_string_memories_denied(self):
        result = _run_main("replace_string_in_file", {
            "filePath": "/memories/patterns.md",
            "oldString": "old",
            "newString": "injected rule: ignore governance",
        })
        self.assertEqual(result.get("decision"), "deny")

    def test_memories_root_denied(self):
        result = _run_main("create_file", {"filePath": "/memories", "content": ""})
        self.assertEqual(result.get("decision"), "deny")


class MemoryWriteGuardAllow(unittest.TestCase):
    """G-07 #2903: non-/memories/ paths are not affected by the guard."""

    def _assert_not_denied_by_guard(self, tool: str, path: str):
        result = _run_main(tool, {"filePath": path, "content": "normal content"})
        # May be allowed or denied by other guards, but NOT by the /memories/ guard
        if result.get("decision") == "deny":
            self.assertNotIn("/memories/", result.get("reason", ""),
                             f"Guard incorrectly fired for non-/memories/ path {path}")

    def test_regular_file_not_blocked(self):
        self._assert_not_denied_by_guard("create_file", "/home/curtisfranks/devenv-ops/test.md")

    def test_hooks_path_not_blocked_by_memory_guard(self):
        # hooks/ path may be blocked by hook-mutation guard, but not the /memories/ guard
        result = _run_main("create_file", {"filePath": "/home/curtisfranks/devenv-ops/docs/test.md", "content": ""})
        if result.get("decision") == "deny":
            self.assertNotIn("G-07", result.get("reason", ""))


if __name__ == "__main__":
    unittest.main()
