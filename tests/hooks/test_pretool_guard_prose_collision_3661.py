"""#3661 — command-detector prose-collision.

The pretool_guard command-CONTEXT gates (create-PR, issue-close, merge, checks,
publish/release, epic-close) must ignore a command STRING quoted inside a
`--body`/here-doc of an issue-comment / artifact-posting call — a prose mention
(a MANAGER_HANDOFF describing the create-PR path, a CONSULTANT_CLOSEOUT citing the
issue-close command) must NOT trip the gate (the #3631 false-block, twice). Unquoted
REAL commands still fire. Reuses the #3471 quote/here-doc masking.
"""
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "hooks" / "scripts"))

import pretool_guard as pg  # noqa: E402

# Built by concatenation only to keep the literals off any shell command line that
# might itself be scanned by the guard; the .py file content is never scanned.
CREATE = "gh pr " + "create"
CLOSE = "gh issue " + "close"
MERGE = "gh pr " + "merge"


class SanitizerMasksProseCommands(unittest.TestCase):
    """AC1/AC2/AC3 mechanism: quoted prose is masked; unquoted real commands survive."""

    def _prose(self, embedded):
        return 'gh issue comment 5 --body "then run %s here"' % embedded

    def test_ac1_create_pr_prose_masked_real_survives(self):
        self.assertTrue(pg.RE_PR_CREATE.search(self._prose(CREATE)), "raw prose matches (the bug)")
        self.assertIsNone(pg.RE_PR_CREATE.search(pg._sanitize_for_redirect_scan(self._prose(CREATE))))
        self.assertTrue(pg.RE_PR_CREATE.search(pg._sanitize_for_redirect_scan("%s --fill" % CREATE)))

    def test_ac2_issue_close_prose_masked_real_survives(self):
        prose = self._prose("%s #5" % CLOSE)
        self.assertIsNone(pg.RE_GH_ISSUE_CLOSE.search(pg._sanitize_for_redirect_scan(prose)))
        self.assertTrue(pg.RE_GH_ISSUE_CLOSE.search(pg._sanitize_for_redirect_scan("%s #5" % CLOSE)))

    def test_ac3_merge_prose_masked_real_survives(self):
        prose = self._prose("%s 5 --squash" % MERGE)
        self.assertIsNone(pg.RE_PR_MERGE.search(pg._sanitize_for_redirect_scan(prose)))
        self.assertTrue(pg.RE_PR_MERGE.search(pg._sanitize_for_redirect_scan("%s 5 --squash" % MERGE)))

    def test_heredoc_body_command_masked(self):
        heredoc = "cat > f <<'EOF'\ndescribe: %s --fill\nEOF" % CREATE
        self.assertIsNone(pg.RE_PR_CREATE.search(pg._sanitize_for_redirect_scan(heredoc)))

    def test_ac4_safety_scans_keep_raw_command(self):
        # dangerous/fleet-curl detectors are NOT sanitized (must see a real command even
        # inside a heredoc); a fleet curl string is still detected on the raw command.
        raw = 'curl http://x:11434/api/generate -d @f'
        self.assertTrue(pg.is_raw_fleet_curl(raw))


class CheckTerminalIgnoresProseFiresOnReal(unittest.TestCase):
    """AC1/AC3 wiring: check_terminal masks prose but still gates a real command."""

    def _decide(self, cmd):
        captured = {}

        def fake_emit(decision, reason, extra=None):
            captured["decision"] = decision
            captured["reason"] = reason
            return 0

        state = {"flags": {"code_touched": True}, "admin_ops": {}, "repo_type": "generic"}
        with patch("pretool_guard.emit", side_effect=fake_emit), \
             patch("pretool_guard.is_main_checkout", return_value=False), \
             patch("pretool_guard.check_one_ticket_per_worktree", return_value=None), \
             patch("pretool_guard.active_ticket_is_no_code_lane", return_value=False), \
             patch("pretool_guard.active_ticket_is_research_lane", return_value=False), \
             patch("pretool_guard.active_ticket_is_docs_lane", return_value=False), \
             patch("pretool_guard.linked_issue_has_collab_handoff", return_value=False), \
             patch("pretool_guard._check_auth_profile", return_value=None), \
             patch("pretool_guard._check_role_tool_allowlist", return_value=None), \
             patch("pretool_guard._check_epic_close_guard", return_value=None):
            pg.check_terminal(cmd, state, str(REPO_ROOT))
        return captured

    def test_prose_create_pr_not_blocked(self):
        out = self._decide('gh issue comment 5 --body "then run %s --fill"' % CREATE)
        self.assertNotEqual(out.get("decision"), "deny",
                            "a quoted create-PR mention must not trip the create-PR gate")

    def test_real_create_pr_still_blocked(self):
        out = self._decide("%s --fill" % CREATE)
        self.assertEqual(out.get("decision"), "deny")
        self.assertIn("PR creation", out.get("reason", ""))

    def test_prose_issue_close_not_blocked(self):
        out = self._decide('gh issue comment 5 --body "closeout cites %s #5"' % CLOSE)
        self.assertNotEqual(out.get("decision"), "deny",
                            "a quoted issue-close mention must not trip the issue-close gate")

    def test_real_issue_close_still_blocked(self):
        out = self._decide("%s 5" % CLOSE)
        self.assertEqual(out.get("decision"), "deny")


if __name__ == "__main__":
    unittest.main()
