"""Unit and integration tests for check_merged_pr() and the merged-branch-guard.
Refs #2878 (AC-I3.4, AC-I3.5).
"""
import json, sys, unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

REPO_ROOT = Path(__file__).resolve().parents[2]
HOOKS_SCRIPTS = REPO_ROOT / "hooks" / "scripts"
if str(HOOKS_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(HOOKS_SCRIPTS))

from live_checks import check_merged_pr  # noqa: E402


def _mock_run(stdout_data, returncode=0):
    """Return a mock subprocess.CompletedProcess for the given JSON data."""
    m = MagicMock()
    m.stdout = json.dumps(stdout_data)
    m.returncode = returncode
    return m


class TestCheckMergedPr(unittest.TestCase):

    @patch("live_checks.subprocess.run")
    def test_merged_pr_found_returns_int(self, mock_run):
        """AC-I3.4: gh returns one merged PR → returns its number as int."""
        mock_run.return_value = _mock_run([{"number": 2881}])
        result = check_merged_pr("feat/2876-some-branch", "/tmp")
        self.assertEqual(result, 2881)
        call_args = mock_run.call_args[0][0]
        self.assertIn("--state", call_args)
        self.assertIn("merged", call_args)

    @patch("live_checks.subprocess.run")
    def test_no_merged_pr_returns_none(self, mock_run):
        """AC-I3.4: gh returns empty list → returns None."""
        mock_run.return_value = _mock_run([])
        result = check_merged_pr("feat/2876-some-branch", "/tmp")
        self.assertIsNone(result)

    @patch("live_checks.subprocess.run", side_effect=Exception("gh not found"))
    def test_gh_cli_error_fails_open(self, _mock_run):
        """AC-I3.4: gh CLI error → returns None (fail-open, never blocks)."""
        result = check_merged_pr("feat/2876-some-branch", "/tmp")
        self.assertIsNone(result)

    @patch("live_checks.subprocess.run")
    def test_empty_stdout_returns_none(self, mock_run):
        """AC-I3.4: empty stdout → returns None (fail-open)."""
        mock_run.return_value = _mock_run(None)
        # Force empty stdout
        mock_run.return_value.stdout = ""
        result = check_merged_pr("main", "/tmp")
        self.assertIsNone(result)

    @patch("live_checks.subprocess.run")
    def test_multiple_prs_returns_first(self, mock_run):
        """check_merged_pr returns the first PR's number when multiple exist."""
        mock_run.return_value = _mock_run([{"number": 99}, {"number": 100}])
        result = check_merged_pr("feat/99-old-branch", "/tmp")
        self.assertEqual(result, 99)


import pretool_guard  # noqa: E402  (must be after sys.path setup)


class TestPretoolGuardMergedBranch(unittest.TestCase):
    """Integration tests for the pretool_guard deny path. AC-I3.5."""

    def _run(self, cmd: str, branch: str, merged_pr=None, commit_done=False):
        captured = {}

        def fake_emit(decision, reason, extra=None):
            captured["decision"] = decision
            captured["reason"] = reason
            return 0

        state = {"flags": {}, "admin_ops": {"commit": commit_done}}
        with patch("pretool_guard.check_merged_pr", return_value=merged_pr), \
             patch("pretool_guard.current_branch", return_value=branch), \
             patch("pretool_guard.emit", side_effect=fake_emit):
            pretool_guard.check_terminal(cmd, state, "/tmp")
        return captured

    def test_deny_on_merged_branch_push(self):
        """AC-I3.5: git push on a merged branch → deny containing PR number."""
        out = self._run("git push origin feat/2876-old", "feat/2876-old", merged_pr=2881, commit_done=True)
        self.assertEqual(out.get("decision"), "deny")
        self.assertIn("2881", out.get("reason", ""))
        self.assertIn("already merged", out.get("reason", ""))

    def test_no_merged_branch_deny_when_not_merged(self):
        """AC-I3.5: push on unmerged branch with commit done → no merged-branch deny."""
        out = self._run("git push origin feat/2878-current", "feat/2878-current", merged_pr=None, commit_done=True)
        self.assertNotIn("already merged", out.get("reason", ""))


if __name__ == "__main__":
    unittest.main()
