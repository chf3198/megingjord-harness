"""Tests for planning_consensus helpers (#2971)."""
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

SCRIPTS = Path(__file__).resolve().parents[2] / "hooks" / "scripts"
sys.path.insert(0, str(SCRIPTS))

import planning_consensus  # noqa: E402

PASS_COMMENT = """## PLANNING_CONSENSUS - PASS
| Round | Judge (family) | Score |
|---|---|---:|
| 1 | Gemini (google) | **96** |
| 1 | Qwen (qwen) | **97** |
Signed-by: Nova Mason
Team&Model: copilot:claude-haiku-4.5@anthropic
Role: manager
"""


class TestConsensusEvaluation(unittest.TestCase):
    def test_accepts_valid_pass_comment(self):
        self.assertTrue(planning_consensus.evaluate_consensus_comment(PASS_COMMENT, planning_consensus.DEFAULT_POLICY))

    def test_rejects_below_threshold(self):
        bad = PASS_COMMENT.replace("96", "92")
        self.assertFalse(planning_consensus.evaluate_consensus_comment(bad, planning_consensus.DEFAULT_POLICY))

    def test_rejects_large_score_spread(self):
        bad = PASS_COMMENT.replace("97", "70")
        self.assertFalse(planning_consensus.evaluate_consensus_comment(bad, planning_consensus.DEFAULT_POLICY))

    def test_rejects_when_min_models_missing(self):
        one = "## PLANNING_CONSENSUS - PASS\n| 1 | Gemini (google) | 99 |"
        self.assertFalse(planning_consensus.evaluate_consensus_comment(one, planning_consensus.DEFAULT_POLICY))

    def test_rejects_missing_cross_family(self):
        one_family = PASS_COMMENT.replace("Qwen (qwen)", "Claude (google)")
        self.assertFalse(planning_consensus.evaluate_consensus_comment(one_family, planning_consensus.DEFAULT_POLICY))

    def test_rejects_cross_family_text_spoof(self):
        spoof = PASS_COMMENT.replace("Qwen (qwen)", "Claude (google)") + "\ncross-family\n"
        self.assertFalse(planning_consensus.evaluate_consensus_comment(spoof, planning_consensus.DEFAULT_POLICY))


class TestLinkedIssueLookup(unittest.TestCase):
    def _run_result(self, comments, returncode=0):
        class R:
            stdout = json.dumps({"comments": comments})
            pass
        r = R()
        r.returncode = returncode
        return r

    def test_linked_issue_has_consensus(self):
        with patch("planning_consensus.subprocess.check_output", return_value="fix/2971-scope\n"):
            with patch("planning_consensus.subprocess.run", return_value=self._run_result([{"body": PASS_COMMENT}])):
                with patch("planning_consensus.load_policy", return_value=planning_consensus.DEFAULT_POLICY):
                    self.assertTrue(planning_consensus.linked_issue_has_planning_consensus("."))

    def test_linked_issue_missing_consensus(self):
        with patch("planning_consensus.subprocess.check_output", return_value="fix/2971-scope\n"):
            with patch("planning_consensus.subprocess.run", return_value=self._run_result([{"body": "none"}])):
                with patch("planning_consensus.load_policy", return_value=planning_consensus.DEFAULT_POLICY):
                    self.assertFalse(planning_consensus.linked_issue_has_planning_consensus("."))

    def test_gh_error_fail_closed(self):
        with patch("planning_consensus.subprocess.check_output", return_value="fix/2971-scope\n"):
            with patch("planning_consensus.subprocess.run", return_value=self._run_result([], returncode=1)):
                with patch("planning_consensus.load_policy", return_value=planning_consensus.DEFAULT_POLICY):
                    self.assertFalse(planning_consensus.linked_issue_has_planning_consensus("."))

    def test_non_ticket_branch_fail_open(self):
        with patch("planning_consensus.subprocess.check_output", return_value="main\n"):
            self.assertTrue(planning_consensus.linked_issue_has_planning_consensus("."))


if __name__ == "__main__":
    unittest.main()
