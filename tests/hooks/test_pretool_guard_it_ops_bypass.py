"""IT-ops bypass tests for pretool_guard commit gate (#2142)."""
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

REPO_ROOT = Path(__file__).resolve().parents[2]
HOOKS_SCRIPTS = REPO_ROOT / "hooks" / "scripts"
sys.path.insert(0, str(HOOKS_SCRIPTS))

import pretool_guard  # noqa: E402


class ItOpsBypassDetector(unittest.TestCase):
    def test_detects_env_marker(self):
        ok, marker = pretool_guard.detect_it_ops_bypass("git commit -m 'maintenance'", {"MEGINGJORD_IT_OPS": "1"})
        self.assertTrue(ok)
        self.assertEqual(marker, "MEGINGJORD_IT_OPS=1")

    def test_detects_literal_marker(self):
        ok, marker = pretool_guard.detect_it_ops_bypass("git commit -m 'chore: refresh [it-ops]'", {})
        self.assertTrue(ok)
        self.assertEqual(marker, "[it-ops]")

    def test_detects_conventional_prefix(self):
        ok, marker = pretool_guard.detect_it_ops_bypass("git commit -m 'chore(it-ops): pull model'", {})
        self.assertTrue(ok)
        self.assertEqual(marker.lower(), "chore(it-ops):")

    def test_no_bypass_when_marker_absent(self):
        ok, marker = pretool_guard.detect_it_ops_bypass("git commit -m 'chore: update docs'", {})
        self.assertFalse(ok)
        self.assertIsNone(marker)


class ItOpsBypassCheckTerminal(unittest.TestCase):
    def _run(self, cmd: str, env: dict[str, str] | None = None, branch: str = "fix/2142-pretool-itops-bypass"):
        state = {"flags": {}, "admin_ops": {"commit": True}, "repo_type": "generic"}
        captured = {}

        def fake_emit(decision, reason, extra=None):
            captured["decision"] = decision
            captured["reason"] = reason
            return 0

        patch_env = env if env is not None else {}
        with patch("pretool_guard.current_branch", return_value=branch),              patch("pretool_guard.emit", side_effect=fake_emit),              patch.dict("pretool_guard.os.environ", patch_env, clear=True):
            pretool_guard.check_terminal(cmd, state, str(REPO_ROOT))
        return captured

    def test_bypass_allows_env_without_ticket(self):
        out = self._run("git commit -m 'maintenance'", {"MEGINGJORD_IT_OPS": "1"})
        self.assertEqual(out.get("decision"), "allow")
        self.assertIn("MEGINGJORD_IT_OPS=1", out.get("reason", ""))

    def test_bypass_allows_literal_without_ticket(self):
        out = self._run("git commit -m 'refresh cache [it-ops]'")
        self.assertEqual(out.get("decision"), "allow")
        self.assertIn("[it-ops]", out.get("reason", ""))

    def test_bypass_allows_conventional_prefix_without_ticket(self):
        out = self._run("git commit -m 'chore(it-ops): rotate model list'")
        self.assertEqual(out.get("decision"), "allow")
        self.assertIn("chore(it-ops)", out.get("reason", "").lower())

    def test_non_bypass_without_ticket_still_denied(self):
        out = self._run("git commit -m 'maintenance update'")
        self.assertEqual(out.get("decision"), "deny")
        self.assertIn("no issue ref", out.get("reason", "").lower())


if __name__ == "__main__":
    unittest.main()
