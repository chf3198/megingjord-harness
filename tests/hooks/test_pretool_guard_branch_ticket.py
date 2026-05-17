"""Branch-ticket parity tests for pretool guard (#1807)."""
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

REPO_ROOT = Path(__file__).resolve().parents[2]
HOOKS_SCRIPTS = REPO_ROOT / "hooks" / "scripts"
sys.path.insert(0, str(HOOKS_SCRIPTS))

import pretool_guard  # noqa: E402


class BranchTicketParity(unittest.TestCase):
    def _run(self, branch: str, cmd: str):
        state = {"flags": {}, "admin_ops": {"commit": True}}
        captured = {}

        def fake_emit(decision, reason, extra=None):
            captured["decision"] = decision
            captured["reason"] = reason
            return 0

        with patch("pretool_guard.current_branch", return_value=branch), \
             patch("pretool_guard.emit", side_effect=fake_emit):
            pretool_guard.check_terminal(cmd, state, str(REPO_ROOT))
        return captured

    def test_allows_matching_ticket_on_ticket_branch(self):
        out = self._run("feat/1807-branch-ticket-match-guard", "git commit -m 'fix hooks (#1807)'")
        self.assertEqual(out, {})

    def test_denies_missing_expected_ticket(self):
        out = self._run("feat/1807-branch-ticket-match-guard", "git commit -m 'fix hooks (#1793)'")
        self.assertEqual(out.get("decision"), "deny")
        self.assertIn("#1807", out.get("reason", ""))

    def test_denies_mismatched_multi_refs(self):
        out = self._run("feat/1807-branch-ticket-match-guard", "git commit -m 'fix hooks (#1807) Refs #1793'")
        self.assertEqual(out.get("decision"), "deny")
        self.assertIn("one branch = one ticket", out.get("reason", ""))

    def test_does_not_enforce_on_main_branch(self):
        out = self._run("main", "git commit -m 'fix hooks (#1793)'")
        self.assertEqual(out, {})


if __name__ == "__main__":
    unittest.main()
