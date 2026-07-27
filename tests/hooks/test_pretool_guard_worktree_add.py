"""GAP-A + GAP-E worktree-add guard tests for pretool_guard (Epic #3854 #3857)."""
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "hooks" / "scripts"))

import pretool_guard  # noqa: E402


class WorktreeAddGuard(unittest.TestCase):
    def _check(self, cmd, fetch_recent=True, attachable=True):
        with patch("pretool_guard._fetch_is_recent", return_value=fetch_recent), \
             patch("pretool_guard._is_attachable_branch", return_value=attachable), \
             patch("pretool_guard._emit_worktree_stale_denied"):
            return pretool_guard.check_worktree_add(cmd, "/repo")

    def test_non_worktree_add_is_ignored(self):
        self.assertIsNone(self._check("git status"))
        self.assertIsNone(self._check("git commit -m 'x (#1)'"))

    def test_gap_e_invalid_branch_name_denied(self):
        out = self._check("git worktree add -b badname ../wt origin/main")
        self.assertEqual(out[0], "deny")
        self.assertIn("violates naming", out[1])

    def test_gap_a_stale_base_denied(self):
        out = self._check("git worktree add -b feat/123-x ../wt origin/main", fetch_recent=False)
        self.assertEqual(out[0], "deny")
        self.assertIn("Fetch-before-branch", out[1])

    def test_gap_a_fresh_base_allowed(self):
        self.assertIsNone(self._check("git worktree add -b feat/123-x ../wt origin/main", fetch_recent=True))

    def test_gap_e_detached_sha_base_denied(self):
        out = self._check("git worktree add ../wt abc1234", attachable=False)
        self.assertEqual(out[0], "deny")
        self.assertIn("detached HEAD", out[1])

    def test_attach_existing_local_branch_allowed(self):
        # `git worktree add <path> <local-branch>` is a valid attach, not detached.
        self.assertIsNone(self._check("git worktree add ../wt feat/123-x", attachable=True))

    def test_valid_agent_worktree_style_allowed(self):
        # agent-worktree.sh: -b <branch> <dir> origin/main, with a recent fetch.
        self.assertIsNone(self._check("git worktree add -b fix/9-y /home/u/wt origin/main", fetch_recent=True))

    def test_fail_open_never_raises(self):
        with patch("pretool_guard.RE_WORKTREE_ADD") as re_mock:
            re_mock.search.side_effect = RuntimeError("boom")
            self.assertIsNone(pretool_guard.check_worktree_add("git worktree add x", "/repo"))


if __name__ == "__main__":
    unittest.main()
