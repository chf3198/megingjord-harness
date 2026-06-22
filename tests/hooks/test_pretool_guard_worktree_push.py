"""#3168 — worktree-correct Admin push-gate.

A committed worktree branch must push even when the session cwd is the main
checkout (on `main`, no ticket commits). Unit-tests the resolver + commit-step
logic and the pretool_guard push decision.
"""
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "hooks" / "scripts"))

import worktree_push_gate as wpg  # noqa: E402


class ResolvePushCwd(unittest.TestCase):
    def test_dash_c_wins(self):
        self.assertEqual(
            wpg.resolve_push_cwd("git -C /home/u/dev-3168 push", "/home/u/main"),
            "/home/u/dev-3168")

    def test_cd_into_worktree(self):
        self.assertEqual(
            wpg.resolve_push_cwd("cd /home/u/dev-3168 && git push", "/home/u/main"),
            "/home/u/dev-3168")

    def test_defaults_to_cwd(self):
        self.assertEqual(wpg.resolve_push_cwd("git push", "/home/u/wt"), "/home/u/wt")


class BranchHasCommitAhead(unittest.TestCase):
    def _run(self, returncode, stdout):
        fake = unittest.mock.MagicMock(returncode=returncode, stdout=stdout)
        with patch("subprocess.run", return_value=fake):
            return wpg.branch_has_commit_ahead("/wt")

    def test_commit_present(self):
        self.assertTrue(self._run(0, "2\n"))

    def test_no_commit(self):
        self.assertFalse(self._run(0, "0\n"))

    def test_git_error_fails_closed(self):
        with patch("subprocess.run", side_effect=FileNotFoundError):
            self.assertFalse(wpg.branch_has_commit_ahead("/wt"))


class CommitStepSatisfied(unittest.TestCase):
    def test_session_flag_short_circuits(self):
        satisfied, used_wt = wpg.commit_step_satisfied("git push", "/wt", True, lambda c: {})
        self.assertEqual((satisfied, used_wt), (True, False))

    def test_worktree_state_records_commit(self):
        load = lambda c: {"admin_ops": {"commit": True}}
        satisfied, used_wt = wpg.commit_step_satisfied(
            "git -C /wt push", "/main", False, load)
        self.assertEqual((satisfied, used_wt), (True, True))

    def test_real_ahead_commit_satisfies(self):
        with patch.object(wpg, "branch_has_commit_ahead", return_value=True):
            satisfied, used_wt = wpg.commit_step_satisfied(
                "git -C /wt push", "/main", False, lambda c: {})
        self.assertEqual((satisfied, used_wt), (True, True))

    def test_nothing_committed_blocks(self):
        with patch.object(wpg, "branch_has_commit_ahead", return_value=False):
            satisfied, used_wt = wpg.commit_step_satisfied(
                "git -C /wt push", "/main", False, lambda c: {})
        self.assertEqual((satisfied, used_wt), (False, False))


class PushGateIntegration(unittest.TestCase):
    def _decide(self, satisfied):
        import pretool_guard
        captured = {}
        state = {"admin_ops": {"commit": False}, "repo_type": "generic"}
        with patch("pretool_guard.emit",
                   side_effect=lambda d, r, e=None: captured.setdefault("d", d)), \
             patch("pretool_guard.current_branch", return_value="fix/3168-x"), \
             patch("pretool_guard.check_merged_pr", return_value=None), \
             patch("worktree_push_gate.commit_step_satisfied",
                   return_value=(satisfied, satisfied)), \
             patch("pretool_guard._emit_worktree_push_desync"):
            pretool_guard.check_terminal("cd /wt && git push", state, "/main")
        return captured.get("d")

    def test_worktree_commit_allows_push(self):
        self.assertIsNone(self._decide(True))

    def test_no_commit_denies_push(self):
        self.assertEqual(self._decide(False), "deny")


if __name__ == "__main__":
    unittest.main()
