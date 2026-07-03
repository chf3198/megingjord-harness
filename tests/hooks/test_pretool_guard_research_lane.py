"""Research-lane close carve-out + anti-abuse diff-guard (#3266).

Mirrors the no-code-remediation lane guards: a CLEAN lane:research ticket may close with no
recorded merge (nothing to merge by design), but a REAL repo diff on a lane:research ticket is
denied and told to re-route to lane:code-change. lane:code-change behaviour is unchanged.
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


class ResearchLaneCloseGuards(unittest.TestCase):
    def setUp(self):
        # code_touched deliberately True (the #3266 stale-flag scenario) to prove the carve-out
        # does not depend on an honest flag.
        self.state = {"flags": {"code_touched": True}, "admin_ops": {},
                      "repo_type": "generic", "active_ticket": 3266}
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
        ]
        for p in self.patchers:
            p.start()

    def tearDown(self):
        for p in self.patchers:
            p.stop()

    def test_AC1_clean_research_close_allowed_without_merge(self):
        # Real close flow removes the execution role label first; with a clean tree the
        # lane:research carve-out skips the merge-precondition, so the close is fully allowed.
        cmd = "gh issue edit 3266 --remove-label role:collaborator && gh issue close 3266"
        with patch("pretool_guard.active_ticket_is_research_lane", return_value=True), \
             patch("pretool_guard.subprocess.run", side_effect=_fake_git_status("")):
            result = pretool_guard.check_terminal(cmd, self.state, str(REPO_ROOT))
        self.assertIsNone(result)                       # no deny returned — fully allowed
        self.assertNotEqual(self.out.get("decision"), "deny")

    def test_AC1_clean_research_skips_merge_precondition(self):
        # Even the bare close command must get PAST the "merge not recorded" gate (the
        # #3266 defect). It may still hit the orthogonal role-label-normalization deny.
        with patch("pretool_guard.active_ticket_is_research_lane", return_value=True), \
             patch("pretool_guard.subprocess.run", side_effect=_fake_git_status("")):
            pretool_guard.check_terminal("gh issue close 3266", self.state, str(REPO_ROOT))
        self.assertNotIn("merge not recorded", self.out.get("reason", ""))

    def test_AC3_research_close_with_real_diff_denied_reroute(self):
        with patch("pretool_guard.active_ticket_is_research_lane", return_value=True), \
             patch("pretool_guard.subprocess.run",
                   side_effect=_fake_git_status(" M hooks/scripts/pretool_guard.py")):
            pretool_guard.check_terminal("gh issue close 3266", self.state, str(REPO_ROOT))
        self.assertEqual(self.out.get("decision"), "deny")
        self.assertIn("lane:research", self.out.get("reason", ""))
        self.assertIn("lane:code-change", self.out.get("reason", ""))

    def test_AC3_code_change_unmerged_close_still_denied(self):
        # Not research, not no-code: the merge-precondition gate is unchanged.
        with patch("pretool_guard.active_ticket_is_research_lane", return_value=False), \
             patch("pretool_guard.subprocess.run", side_effect=_fake_git_status("")):
            pretool_guard.check_terminal("gh issue close 3266", self.state, str(REPO_ROOT))
        self.assertEqual(self.out.get("decision"), "deny")
        self.assertIn("merge not recorded", self.out.get("reason", ""))


if __name__ == "__main__":
    unittest.main()
