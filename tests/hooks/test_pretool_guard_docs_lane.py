"""Docs-lane close carve-out + anti-abuse diff-guard (#3569).

Generalizes the #3266 research-lane carve-out to lane:docs-research and lane:docs-only. A CLEAN
docs-lane ticket may close with no recorded merge (report-only "Manager+Consultant" batons are
PR-less/merge-less by design), but a REAL repo diff on a docs lane is denied and told to re-route
to lane:code-change (the clean-tree condition is load-bearing — docs edits ARE a real diff).
lane:research / lane:no-code-remediation / lane:code-change behaviour is unchanged.
"""
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch

REPO_ROOT = Path(__file__).resolve().parents[2]
HOOKS_SCRIPTS = REPO_ROOT / "hooks" / "scripts"
sys.path.insert(0, str(HOOKS_SCRIPTS))

import pretool_guard  # noqa: E402


def _fake_git_status(stdout):
    def _run(args, *a, **k):
        text = " ".join(args) if isinstance(args, (list, tuple)) else str(args)
        out = stdout if ("status" in text and "--porcelain" in text) else ""
        return types.SimpleNamespace(stdout=out, returncode=0)
    return _run


class DocsLanePredicate(unittest.TestCase):
    def test_AC1_true_for_docs_research(self):
        with patch("pretool_guard._active_ticket_labels", return_value={"lane:docs-research"}):
            self.assertTrue(pretool_guard.active_ticket_is_docs_lane({}, "."))

    def test_AC1_true_for_docs_only(self):
        with patch("pretool_guard._active_ticket_labels", return_value={"lane:docs-only"}):
            self.assertTrue(pretool_guard.active_ticket_is_docs_lane({}, "."))

    def test_AC1_false_for_code_change_and_research(self):
        for labels in ({"lane:code-change"}, {"lane:research"}, set()):
            with patch("pretool_guard._active_ticket_labels", return_value=labels):
                self.assertFalse(pretool_guard.active_ticket_is_docs_lane({}, "."))


class DocsLaneCloseGuards(unittest.TestCase):
    def setUp(self):
        # code_touched deliberately True (the stale-flag scenario) to prove the carve-out does
        # not depend on an honest flag.
        self.state = {"flags": {"code_touched": True}, "admin_ops": {},
                      "repo_type": "generic", "active_ticket": 3569}
        self.out = {}

        def fake_emit(decision, reason, extra=None):
            self.out["decision"], self.out["reason"] = decision, reason
            return 0

        self.patchers = [
            patch("pretool_guard.emit", side_effect=fake_emit),
            patch("pretool_guard._check_auth_profile", return_value=None),
            patch("pretool_guard._check_role_tool_allowlist", return_value=None),
            patch("pretool_guard._check_epic_close_guard", return_value=None),
            patch("pretool_guard.active_ticket_is_no_code_lane", return_value=False),
            patch("pretool_guard.active_ticket_is_research_lane", return_value=False),
            patch("pretool_guard.active_ticket_is_docs_lane", return_value=True),
        ]
        for p in self.patchers:
            p.start()

    def tearDown(self):
        for p in self.patchers:
            p.stop()

    def test_AC2_clean_docs_close_allowed_without_merge(self):
        cmd = "gh issue edit 3569 --remove-label role:collaborator && gh issue close 3569"
        with patch("pretool_guard.subprocess.run", side_effect=_fake_git_status("")):
            result = pretool_guard.check_terminal(cmd, self.state, str(REPO_ROOT))
        self.assertIsNone(result)
        self.assertNotEqual(self.out.get("decision"), "deny")

    def test_AC2_clean_docs_skips_merge_precondition(self):
        with patch("pretool_guard.subprocess.run", side_effect=_fake_git_status("")):
            pretool_guard.check_terminal("gh issue close 3569", self.state, str(REPO_ROOT))
        self.assertNotIn("merge not recorded", self.out.get("reason", ""))

    def test_AC3_docs_close_with_real_diff_denied_reroute(self):
        with patch("pretool_guard.subprocess.run",
                   side_effect=_fake_git_status(" M docs/howto/hooks.md")):
            pretool_guard.check_terminal("gh issue close 3569", self.state, str(REPO_ROOT))
        self.assertEqual(self.out.get("decision"), "deny")
        self.assertIn("lane:docs", self.out.get("reason", ""))
        self.assertIn("lane:code-change", self.out.get("reason", ""))


class NonDocsLaneUnchanged(unittest.TestCase):
    def test_AC5_code_change_unmerged_close_still_denied(self):
        state = {"flags": {"code_touched": True}, "admin_ops": {},
                 "repo_type": "generic", "active_ticket": 3569}
        out = {}

        def fake_emit(decision, reason, extra=None):
            out["decision"], out["reason"] = decision, reason
            return 0

        with patch("pretool_guard.emit", side_effect=fake_emit), \
             patch("pretool_guard._check_auth_profile", return_value=None), \
             patch("pretool_guard._check_role_tool_allowlist", return_value=None), \
             patch("pretool_guard._check_epic_close_guard", return_value=None), \
             patch("pretool_guard.active_ticket_is_no_code_lane", return_value=False), \
             patch("pretool_guard.active_ticket_is_research_lane", return_value=False), \
             patch("pretool_guard.active_ticket_is_docs_lane", return_value=False), \
             patch("pretool_guard.subprocess.run", side_effect=_fake_git_status("")):
            pretool_guard.check_terminal("gh issue close 3569", state, str(REPO_ROOT))
        self.assertEqual(out.get("decision"), "deny")
        self.assertIn("merge not recorded", out.get("reason", ""))


if __name__ == "__main__":
    unittest.main()
