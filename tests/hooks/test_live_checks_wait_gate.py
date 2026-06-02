"""Regression tests for wait-for-green merge discipline (#2573)."""
import sys
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[2] / "hooks" / "scripts"
sys.path.insert(0, str(SCRIPTS))

import live_checks  # noqa: E402
import pretool_guard  # noqa: E402


class ClassifyChecks(unittest.TestCase):
    def test_pending_only(self):
        checks = [{"state": "IN_PROGRESS", "conclusion": ""}]
        self.assertEqual(live_checks.classify_ci_checks(checks), "pending-only")

    def test_failing(self):
        checks = [{"state": "COMPLETED", "conclusion": "failure"}]
        self.assertEqual(live_checks.classify_ci_checks(checks), "failing")

    def test_green_but_policy_blocked(self):
        checks = [{"state": "COMPLETED", "conclusion": "success"}]
        self.assertEqual(
            live_checks.classify_merge_flow_state(checks, merge_policy_blocked=True),
            "green-but-policy-blocked",
        )


class PretToolMergeGate(unittest.TestCase):
    def _state(self):
        return {
            "repo_type": "generic",
            "flags": {},
            "admin_ops": {"pr_create": True},
        }

    def test_pending_blocks_merge(self):
        pretool_guard.emit = lambda decision, reason, extra=None: (decision, reason, extra)
        pretool_guard.ci_gate_status = lambda _pr, _cwd: "pending-only"
        result = pretool_guard.check_terminal("gh pr merge 99", self._state(), ".")
        self.assertEqual(result[0], "deny")
        self.assertIn("still pending", result[1])

    def test_failing_blocks_merge(self):
        pretool_guard.emit = lambda decision, reason, extra=None: (decision, reason, extra)
        pretool_guard.ci_gate_status = lambda _pr, _cwd: "failing"
        result = pretool_guard.check_terminal("gh pr merge 99", self._state(), ".")
        self.assertEqual(result[0], "deny")
        self.assertIn("not fully green", result[1])


if __name__ == "__main__":
    unittest.main()
