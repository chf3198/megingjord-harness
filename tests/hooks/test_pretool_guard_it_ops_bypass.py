"""IT-ops commit-gate bypass tests for pretool_guard (#2142)."""
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

REPO_ROOT = Path(__file__).resolve().parents[2]
HOOKS_SCRIPTS = REPO_ROOT / "hooks" / "scripts"
sys.path.insert(0, str(HOOKS_SCRIPTS))

import pretool_guard  # noqa: E402


class ItOpsBypassDetector(unittest.TestCase):
    """#2142 AC1: detect_it_ops_bypass recognizes the 3 marker variants."""

    def test_env_var_marker(self):
        bypass, marker = pretool_guard.detect_it_ops_bypass("any string", env={"MEGINGJORD_IT_OPS": "1"})
        self.assertTrue(bypass)
        self.assertEqual(marker, "env:MEGINGJORD_IT_OPS=1")

    def test_subject_literal_marker(self):
        bypass, marker = pretool_guard.detect_it_ops_bypass("git commit -m 'add qwen3 model [it-ops]'", env={})
        self.assertTrue(bypass)
        self.assertEqual(marker, "commit-subject-marker")

    def test_chore_it_ops_prefix(self):
        bypass, marker = pretool_guard.detect_it_ops_bypass("git commit -m 'chore(it-ops): pull qwen3:32b'", env={})
        self.assertTrue(bypass)
        self.assertEqual(marker, "commit-subject-marker")

    def test_case_insensitive_marker(self):
        bypass, _ = pretool_guard.detect_it_ops_bypass("git commit -m 'CHORE(IT-OPS): X'", env={})
        self.assertTrue(bypass)

    def test_no_marker_no_env(self):
        bypass, marker = pretool_guard.detect_it_ops_bypass("git commit -m 'regular commit'", env={})
        self.assertFalse(bypass)
        self.assertIsNone(marker)

    def test_env_var_zero_does_not_bypass(self):
        bypass, _ = pretool_guard.detect_it_ops_bypass("git commit -m 'x'", env={"MEGINGJORD_IT_OPS": "0"})
        self.assertFalse(bypass)


class CheckTerminalItOpsBypass(unittest.TestCase):
    """#2142 AC1+AC2+AC3: check_terminal integrates bypass + emits advisory + preserves regular behavior."""

    def _run(self, cmd, branch="main", env=None):
        state = {"flags": {}, "admin_ops": {"commit": True}}
        captured = {}

        def fake_emit(decision, reason, extra=None):
            captured["decision"] = decision
            captured["reason"] = reason
            return 0

        bypass_fn = pretool_guard.detect_it_ops_bypass
        patches = [
            patch("pretool_guard.current_branch", return_value=branch),
            patch("pretool_guard.emit", side_effect=fake_emit),
        ]
        if env is not None:
            patches.append(patch("pretool_guard.detect_it_ops_bypass", side_effect=lambda j, e=None: bypass_fn(j, env=env)))
        for p in patches:
            p.start()
        try:
            pretool_guard.check_terminal(cmd, state, str(REPO_ROOT))
        finally:
            for p in patches:
                p.stop()
        return captured

    def test_bypass_via_env_var_emits_allow_advisory(self):
        out = self._run("git commit -m 'add qwen3:32b'", env={"MEGINGJORD_IT_OPS": "1"})
        self.assertEqual(out.get("decision"), "allow")
        self.assertIn("IT-ops commit bypass", out.get("reason", ""))
        self.assertIn("MEGINGJORD_IT_OPS", out.get("reason", ""))

    def test_bypass_via_subject_marker_emits_allow_advisory(self):
        out = self._run("git commit -m 'add qwen3 [it-ops]'", env={})
        self.assertEqual(out.get("decision"), "allow")
        self.assertIn("IT-ops commit bypass", out.get("reason", ""))

    def test_bypass_via_chore_prefix(self):
        out = self._run("git commit -m 'chore(it-ops): pull model'", env={})
        self.assertEqual(out.get("decision"), "allow")

    def test_no_bypass_no_ticket_still_denied(self):
        """AC3 regression: regular commit without #N + no marker still denied."""
        out = self._run("git commit -m 'regular fix'", env={})
        self.assertEqual(out.get("decision"), "deny")
        self.assertIn("no issue ref (#N)", out.get("reason", ""))

    def test_no_bypass_with_ticket_allowed(self):
        """AC3 regression: regular commit with #N on main branch passes through."""
        out = self._run("git commit -m 'fix something #1234'", env={})
        self.assertEqual(out, {})

    def test_bypass_overrides_branch_ticket_mismatch(self):
        """AC1: bypass also short-circuits the branch-ticket-match check (line 55-62)."""
        out = self._run("git commit -m 'chore(it-ops): pull model'", branch="feat/1234-some-feature", env={})
        self.assertEqual(out.get("decision"), "allow")


if __name__ == "__main__":
    unittest.main()
