"""Regression tests for wait-for-green merge discipline (#2573)."""
import sys
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[2] / "hooks" / "scripts"
sys.path.insert(0, str(SCRIPTS))

import live_checks  # noqa: E402
import pretool_guard  # noqa: E402


class ClassifyChecks(unittest.TestCase):
    def test_pending_only(self):
        checks = [{"state": "IN_PROGRESS", "conclusion": ""}]
        self.assertEqual(live_checks.classify_ci_checks(checks), "pending-only")

    def test_failing(self):
        checks = [{"state": "COMPLETED", "conclusion": "failure"}]
        self.assertEqual(live_checks.classify_ci_checks(checks), "failing")

    def test_green_but_policy_blocked(self):
        checks = [{"state": "COMPLETED", "conclusion": "success"}]
        self.assertEqual(
            live_checks.classify_merge_flow_state(checks, merge_policy_blocked=True),
            "green-but-policy-blocked",
        )


class PretToolMergeGate(unittest.TestCase):
    def _state(self):
        return {
            "repo_type": "generic",
            "flags": {},
            "admin_ops": {"pr_create": True},
        }

    def test_pending_blocks_merge(self):
        pretool_guard.emit = lambda decision, reason, extra=None: (decision, reason, extra)
        pretool_guard.ci_gate_status_stable = lambda _pr, _cwd: "pending-only"
        result = pretool_guard.check_terminal("gh pr merge 99", self._state(), ".")
        self.assertEqual(result[0], "deny")
        self.assertIn("still pending", result[1])

    def test_failing_blocks_merge(self):
        pretool_guard.emit = lambda decision, reason, extra=None: (decision, reason, extra)
        pretool_guard.ci_gate_status_stable = lambda _pr, _cwd: "failing"
        result = pretool_guard.check_terminal("gh pr merge 99", self._state(), ".")
        self.assertEqual(result[0], "deny")
        self.assertIn("not fully green", result[1])

    def test_transient_unknown_resolving_green_allows_merge(self):
        # #2603: a green stable result must NOT hit the not-fully-green deny.
        pretool_guard.emit = lambda decision, reason, extra=None: (decision, reason, extra)
        pretool_guard.ci_gate_status_stable = lambda _pr, _cwd: "green"
        result = pretool_guard.check_terminal("gh pr merge 99", self._state(), ".")
        self.assertNotEqual(result, ("deny", "Merge blocked: required CI checks are not fully green (live API check).", None))


class CiGateStatusJsonFallback(unittest.TestCase):
    """#2596 — empty `gh pr checks --json` must fall back to the plain exit code."""

    def _status(self, json_stdout, plain_rc):
        from unittest.mock import patch, MagicMock

        def side_effect(cmd, **kw):
            m = MagicMock()
            if "--json" in cmd:
                m.stdout = json_stdout
                m.returncode = 0 if json_stdout.strip() not in ("", "[]") else 1
            else:  # plain `gh pr checks <pr>` fallback
                m.stdout = ""
                m.returncode = plain_rc
            return m

        with patch("live_checks.subprocess.run", side_effect=side_effect):
            return live_checks.ci_gate_status("99", ".")

    def test_nonempty_json_unchanged(self):
        self.assertEqual(self._status('[{"state": "COMPLETED", "conclusion": "success"}]', 1), "green")

    def test_empty_json_exit0_green(self):
        self.assertEqual(self._status("", 0), "green")

    def test_empty_json_exit8_pending(self):
        self.assertEqual(self._status("", 8), "pending-only")

    def test_empty_json_exit1_failing(self):
        self.assertEqual(self._status("", 1), "failing")

    def test_empty_json_exit2_unknown(self):
        self.assertEqual(self._status("", 2), "unknown")


class CiGateStatusStableRetry(unittest.TestCase):
    """#2603 — indeterminate 'unknown' is retried, not conflated with failing."""

    def _stable(self, sequence):
        from unittest.mock import patch
        calls = {"n": 0}

        def fake_status(_pr, _cwd):
            i = min(calls["n"], len(sequence) - 1)
            calls["n"] += 1
            return sequence[i]

        with patch("live_checks.ci_gate_status", side_effect=fake_status):
            result = live_checks.ci_gate_status_stable("99", ".", sleep_fn=lambda _s: None)
        return result, calls["n"]

    def test_transient_unknown_then_green_allows(self):
        result, n = self._stable(["unknown", "green"])
        self.assertEqual(result, "green")
        self.assertEqual(n, 2)  # one retry

    def test_persistent_unknown_stays_unknown(self):
        result, n = self._stable(["unknown"])
        self.assertEqual(result, "unknown")
        self.assertEqual(n, 3)  # attempts=3 → initial + 2 retries

    def test_immediate_green_no_retry(self):
        result, n = self._stable(["green", "failing"])
        self.assertEqual(result, "green")
        self.assertEqual(n, 1)

    def test_immediate_failing_no_retry(self):
        result, n = self._stable(["failing"])
        self.assertEqual(result, "failing")
        self.assertEqual(n, 1)

    def test_pending_only_not_retried(self):
        result, n = self._stable(["pending-only"])
        self.assertEqual(result, "pending-only")
        self.assertEqual(n, 1)


if __name__ == "__main__":
    unittest.main()
