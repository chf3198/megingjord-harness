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
Signed-by: Caden Mason
Team&Model: codex:gpt-5.3-codex@openai
Role: manager
"""


class TestConsensusEvaluation(unittest.TestCase):
    def _accepts(self, text):
        with patch("planning_consensus._signature_matches_registry", return_value=True):
            return planning_consensus.evaluate_consensus_comment(
                text, planning_consensus.DEFAULT_POLICY,
                cwd=".", author_association="OWNER",
            )

    def test_accepts_valid_pass_comment(self):
        self.assertTrue(self._accepts(PASS_COMMENT))

    def test_rejects_below_threshold(self):
        self.assertFalse(self._accepts(PASS_COMMENT.replace("96", "92")))

    def test_rejects_large_score_spread(self):
        self.assertFalse(self._accepts(PASS_COMMENT.replace("97", "70")))

    def test_rejects_when_min_models_missing(self):
        one = "## PLANNING_CONSENSUS - PASS\n| 1 | Gemini (google) | 99 |"
        self.assertFalse(self._accepts(one))

    def test_rejects_missing_cross_family(self):
        self.assertFalse(self._accepts(PASS_COMMENT.replace("Qwen (qwen)", "Claude (google)")))

    def test_rejects_cross_family_text_spoof(self):
        spoof = PASS_COMMENT.replace("Qwen (qwen)", "Claude (google)") + "\ncross-family\n"
        self.assertFalse(self._accepts(spoof))

    def test_rejects_untrusted_author_association(self):
        with patch("planning_consensus._signature_matches_registry", return_value=True):
            ok = planning_consensus.evaluate_consensus_comment(
                PASS_COMMENT, planning_consensus.DEFAULT_POLICY,
                cwd=".", author_association="NONE",
            )
            self.assertFalse(ok)

    def test_rejects_when_round_exceeds_policy(self):
        over = PASS_COMMENT.replace("| 1 | Qwen", "| 4 | Qwen")
        self.assertFalse(self._accepts(over))

    def test_rejects_multi_artifact_ambiguity(self):
        ambiguous = PASS_COMMENT + "\n## PLANNING_CONSENSUS - FAIL\n| 1 | Qwen (qwen) | 10 |\n"
        self.assertFalse(self._accepts(ambiguous))

    def test_rejects_when_signature_registry_mismatch(self):
        with patch("planning_consensus._signature_matches_registry", return_value=False):
            ok = planning_consensus.evaluate_consensus_comment(
                PASS_COMMENT, planning_consensus.DEFAULT_POLICY,
                cwd=".", author_association="OWNER",
            )
            self.assertFalse(ok)

    def test_rejects_role_mismatch_even_with_valid_signature(self):
        bad_role = PASS_COMMENT.replace("Role: manager", "Role: collaborator")
        with patch("planning_consensus._signature_matches_registry", wraps=planning_consensus._signature_matches_registry):
            self.assertFalse(
                planning_consensus.evaluate_consensus_comment(
                    bad_role, planning_consensus.DEFAULT_POLICY,
                    cwd=".", author_association="OWNER",
                )
            )


class TestLinkedIssueLookup(unittest.TestCase):
    def _run_result(self, comments, returncode=0):
        class R:
            stdout = json.dumps({"comments": comments})
            pass
        r = R()
        r.returncode = returncode
        return r

    def test_linked_issue_has_consensus(self):
        comments = [{"body": PASS_COMMENT, "authorAssociation": "OWNER"}]
        with patch("planning_consensus.subprocess.check_output", return_value="fix/3000-scope\n"):
            with patch("planning_consensus.subprocess.run", return_value=self._run_result(comments)):
                with patch("planning_consensus.load_policy", return_value=planning_consensus.DEFAULT_POLICY):
                    with patch("planning_consensus._signature_matches_registry", return_value=True):
                        self.assertTrue(planning_consensus.linked_issue_has_planning_consensus("."))

    def test_linked_issue_missing_consensus(self):
        comments = [{"body": "none", "authorAssociation": "OWNER"}]
        with patch("planning_consensus.subprocess.check_output", return_value="fix/3000-scope\n"):
            with patch("planning_consensus.subprocess.run", return_value=self._run_result(comments)):
                with patch("planning_consensus.load_policy", return_value=planning_consensus.DEFAULT_POLICY):
                    self.assertFalse(planning_consensus.linked_issue_has_planning_consensus("."))

    def test_gh_error_fail_closed(self):
        with patch("planning_consensus.subprocess.check_output", return_value="fix/3000-scope\n"):
            with patch("planning_consensus.subprocess.run", return_value=self._run_result([], returncode=1)):
                with patch("planning_consensus.load_policy", return_value=planning_consensus.DEFAULT_POLICY):
                    self.assertFalse(planning_consensus.linked_issue_has_planning_consensus("."))

    def test_non_ticket_branch_fail_open(self):
        with patch("planning_consensus.subprocess.check_output", return_value="main\n"):
            self.assertTrue(planning_consensus.linked_issue_has_planning_consensus("."))


if __name__ == "__main__":
    unittest.main()
