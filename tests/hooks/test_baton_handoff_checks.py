"""Unit tests for branch-scoped MANAGER_HANDOFF authority (#3204)."""
import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

SCRIPTS = Path(__file__).resolve().parents[2] / "hooks" / "scripts"
sys.path.insert(0, str(SCRIPTS))

import baton_handoff_checks as bhc  # noqa: E402


def _run(stdout: str):
    r = MagicMock()
    r.stdout = stdout
    r.returncode = 0
    return r


class TestAuthoritativeManagerHandoff(unittest.TestCase):
    def test_matching_worktree_branch(self):
        body = '{"comments":[{"body":"## MANAGER_HANDOFF\\nworktree_branch: feat/99-slug"}]}'
        with patch("subprocess.check_output", return_value="feat/99-slug\n"):
            with patch("subprocess.run", return_value=_run(body)):
                self.assertTrue(bhc.linked_issue_has_authoritative_manager_handoff("."))

    def test_stale_without_worktree_branch(self):
        body = '{"comments":[{"body":"## MANAGER_HANDOFF\\nticket: #99"}]}'
        with patch("subprocess.check_output", return_value="feat/99-slug\n"):
            with patch("subprocess.run", return_value=_run(body)):
                self.assertFalse(bhc.linked_issue_has_authoritative_manager_handoff("."))

    def test_branch_mismatch(self):
        body = '{"comments":[{"body":"## MANAGER_HANDOFF\\nworktree_branch: feat/99-other"}]}'
        with patch("subprocess.check_output", return_value="feat/99-slug\n"):
            with patch("subprocess.run", return_value=_run(body)):
                self.assertFalse(bhc.linked_issue_has_authoritative_manager_handoff("."))

    def test_latest_wins(self):
        body = '{"comments":[' \
               '{"body":"## MANAGER_HANDOFF\\nworktree_branch: feat/99-old"},' \
               '{"body":"## MANAGER_HANDOFF\\nworktree_branch: feat/99-slug"}]}'
        with patch("subprocess.check_output", return_value="feat/99-slug\n"):
            with patch("subprocess.run", return_value=_run(body)):
                self.assertTrue(bhc.linked_issue_has_authoritative_manager_handoff("."))

    def test_no_ticket_branch_fail_open(self):
        with patch("subprocess.check_output", return_value="main\n"):
            self.assertTrue(bhc.linked_issue_has_authoritative_manager_handoff("."))


if __name__ == "__main__":
    unittest.main()
