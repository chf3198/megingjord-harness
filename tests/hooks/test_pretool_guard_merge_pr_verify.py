"""Merge-gate real-PR verification tests (#3344).

When the cwd-keyed admin_ops.pr_create flag is lost to cwd-churn, the merge gate
must verify a real OPEN PR before blocking: allow ONLY on a confirmed-OPEN PR;
fail-CLOSED (block) on no-PR or an indeterminate gh error.
"""
import json
import subprocess
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

REPO_ROOT = Path(__file__).resolve().parents[2]
HOOKS_SCRIPTS = REPO_ROOT / "hooks" / "scripts"
sys.path.insert(0, str(HOOKS_SCRIPTS))

import pretool_guard  # noqa: E402
import live_checks  # noqa: E402

MERGE_CMD = "gh pr merge 3349 --merge"


class MergeGatePrVerify(unittest.TestCase):
    """Gate branch behavior when admin_ops.pr_create is missing (cwd-churn)."""

    def _run(self, pr_verify_return, ci="passing"):
        state = {"flags": {}, "admin_ops": {"commit": True}, "repo_type": "generic"}
        captured = {}

        def fake_emit(decision, reason, extra=None):
            captured["decision"] = decision
            captured["reason"] = reason
            return 0

        with patch("pretool_guard.emit", side_effect=fake_emit), \
             patch("pretool_guard.require_bypass_exception", return_value=False), \
             patch("pretool_guard.open_pr_for_ref", return_value=pr_verify_return) as m, \
             patch("pretool_guard.ci_gate_status_stable", return_value=ci):
            pretool_guard.check_terminal(MERGE_CMD, state, str(REPO_ROOT))
        return captured, m

    def test_ac1_real_open_pr_allows(self):
        out, mock = self._run(True)
        self.assertNotEqual(out.get("decision"), "deny",
                            "a confirmed OPEN PR must not be blocked for missing pr_create")
        mock.assert_called_once_with("3349", str(REPO_ROOT))

    def test_ac1_no_pr_blocks(self):
        out, _ = self._run(False)
        self.assertEqual(out.get("decision"), "deny")
        self.assertIn("no open PR", out.get("reason", ""))

    def test_ac1_indeterminate_gh_fails_closed(self):
        out, _ = self._run(None)
        self.assertEqual(out.get("decision"), "deny",
                        "indeterminate gh must fail CLOSED (retain the block)")

    def test_pr_create_recorded_skips_verify(self):
        # When pr_create IS recorded, the real-PR verify must not run at all.
        state = {"flags": {}, "admin_ops": {"commit": True, "pr_create": True},
                 "repo_type": "generic"}
        with patch("pretool_guard.emit", return_value=0), \
             patch("pretool_guard.require_bypass_exception", return_value=False), \
             patch("pretool_guard.open_pr_for_ref") as m, \
             patch("pretool_guard.ci_gate_status_stable", return_value="passing"):
            pretool_guard.check_terminal(MERGE_CMD, state, str(REPO_ROOT))
        m.assert_not_called()


class OpenPrForRefFaultInjection(unittest.TestCase):
    """Stress/fault-injection of live_checks.open_pr_for_ref."""

    def _mock_run(self, returncode=0, stdout="{}", raises=None):
        def fake(*a, **k):
            if raises:
                raise raises
            return subprocess.CompletedProcess(a, returncode, stdout=stdout, stderr="")
        return fake

    def test_open_pr_returns_true(self):
        with patch("live_checks.subprocess.run",
                   side_effect=self._mock_run(0, json.dumps({"state": "OPEN", "number": 3349}))):
            self.assertIs(live_checks.open_pr_for_ref("3349", "."), True)

    def test_merged_pr_returns_false(self):
        with patch("live_checks.subprocess.run",
                   side_effect=self._mock_run(0, json.dumps({"state": "MERGED"}))):
            self.assertIs(live_checks.open_pr_for_ref("3349", "."), False)

    def test_absent_pr_nonzero_returns_false(self):
        with patch("live_checks.subprocess.run", side_effect=self._mock_run(1, "")):
            self.assertIs(live_checks.open_pr_for_ref("nope", "."), False)

    def test_timeout_returns_none_fail_closed(self):
        with patch("live_checks.subprocess.run",
                   side_effect=self._mock_run(raises=subprocess.TimeoutExpired("gh", 20))):
            self.assertIsNone(live_checks.open_pr_for_ref("3349", "."))

    def test_gh_absent_returns_none(self):
        with patch("live_checks.subprocess.run",
                   side_effect=self._mock_run(raises=FileNotFoundError("gh"))):
            self.assertIsNone(live_checks.open_pr_for_ref("3349", "."))

    def test_malformed_json_returns_none(self):
        with patch("live_checks.subprocess.run", side_effect=self._mock_run(0, "not json")):
            self.assertIsNone(live_checks.open_pr_for_ref("3349", "."))

    def test_empty_ref_returns_none_without_calling_gh(self):
        with patch("live_checks.subprocess.run") as m:
            self.assertIsNone(live_checks.open_pr_for_ref("", "."))
            m.assert_not_called()


if __name__ == "__main__":
    unittest.main()
