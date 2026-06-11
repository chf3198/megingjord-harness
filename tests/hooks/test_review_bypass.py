"""tdd-pyramid (pytest) for the C7 review-bypass gate Python twin (#2933 / Epic #2926 C7)."""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "hooks", "scripts"))

from hamr_fleet_direct_block import is_review_context, review_bypass_decision  # noqa: E402

PAID = {"detected": True, "suppressed": False, "severity": "paid-bypass", "providers": [{"name": "gemini"}]}
FLEET = {"detected": True, "suppressed": False, "severity": "fleet-bypass", "providers": [{"name": "ollama"}]}


class TestReviewBypass(unittest.TestCase):
    def test_is_review_context_keyword(self):
        self.assertTrue(is_review_context("curl gemini -d 'review this diff'", {}))
        self.assertTrue(is_review_context("run an adversarial critique", {}))
        self.assertFalse(is_review_context("npm run build", {}))

    def test_is_review_context_env_flag(self):
        self.assertTrue(is_review_context("curl https://api.openai.com", {"MEGINGJORD_REVIEW_CONTEXT": "1"}))

    def test_paid_bypass_review_advisory_default(self):
        d = review_bypass_decision(PAID, "curl gemini ... rubric review", {})
        self.assertTrue(d["flag"])
        self.assertFalse(d["block"])
        self.assertTrue(d["advisory"])
        self.assertEqual(d["providers"], ["gemini"])

    def test_paid_bypass_review_blocks_under_flag(self):
        d = review_bypass_decision(PAID, "review via raw gemini", {"MEGINGJORD_REVIEW_BYPASS_BLOCK": "1"})
        self.assertTrue(d["flag"])
        self.assertTrue(d["block"])

    def test_not_flagged_outside_review_context(self):
        self.assertFalse(review_bypass_decision(PAID, "curl https://api.openai.com summarize logs", {})["flag"])

    def test_block_flag_does_not_overblock_non_review_paid_calls(self):
        # False-positive guard (#2933 review): even with the block flag ON, a non-review paid call
        # must NOT be flagged/blocked — only review-context paid calls are in scope.
        d = review_bypass_decision(PAID, "curl https://api.openai.com summarize logs",
                                   {"MEGINGJORD_REVIEW_BYPASS_BLOCK": "1"})
        self.assertFalse(d["flag"])
        self.assertFalse(d["block"])

    def test_fleet_bypass_not_this_gate(self):
        self.assertFalse(review_bypass_decision(FLEET, "review via raw ollama curl", {})["flag"])

    def test_suppressed_and_no_detection_never_flag(self):
        self.assertFalse(review_bypass_decision({**PAID, "suppressed": True}, "review", {})["flag"])
        self.assertFalse(review_bypass_decision({"detected": False}, "review", {})["flag"])
        self.assertFalse(review_bypass_decision(None, "review", {})["flag"])


if __name__ == "__main__":
    unittest.main()
