"""Regression tests: ci_gate_status must fail only on REQUIRED red checks (#3664).

Branch-protection non-required advisory checks (e.g. "worktree-governance-required",
"Doc update required") were false-blocking `gh pr merge` in the local pre-merge gate.
`gh pr checks --json` carries no isRequired field, so ci_gate_status now resolves the
base branch's required-context set and filters advisory reds out before classifying.
"""
import sys
import types
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[2] / "hooks" / "scripts"
sys.path.insert(0, str(SCRIPTS))

import live_checks  # noqa: E402


class FilterToRequired(unittest.TestCase):
    def test_keeps_only_required_names(self):
        checks = [{"name": "req-a"}, {"name": "advisory-b"}, {"name": "req-c"}]
        out = live_checks.filter_to_required(checks, {"req-a", "req-c"})
        self.assertEqual([c["name"] for c in out], ["req-a", "req-c"])

    def test_none_required_is_legacy_all_checks(self):
        checks = [{"name": "a"}, {"name": "b"}]
        self.assertEqual(live_checks.filter_to_required(checks, None), checks)

    def test_empty_required_is_legacy_all_checks(self):
        checks = [{"name": "a"}]
        self.assertEqual(live_checks.filter_to_required(checks, set()), checks)


class CiGateStatusRequiredOnly(unittest.TestCase):
    def _patch_checks(self, checks_json, required):
        payload = checks_json

        def fake_run(cmd, *a, **k):
            return types.SimpleNamespace(stdout=payload, returncode=0)

        self._orig_run = live_checks.subprocess.run
        self._orig_req = live_checks._required_contexts
        live_checks.subprocess.run = fake_run
        live_checks._required_contexts = lambda pr_ref, cwd: required

    def tearDown(self):
        if hasattr(self, "_orig_run"):
            live_checks.subprocess.run = self._orig_run
        if hasattr(self, "_orig_req"):
            live_checks._required_contexts = self._orig_req

    def test_nonrequired_red_required_green_is_green(self):
        checks = (
            '[{"name": "req-ci", "state": "COMPLETED", "conclusion": "success"},'
            ' {"name": "worktree-governance-required", "state": "COMPLETED", "conclusion": "failure"}]'
        )
        self._patch_checks(checks, {"req-ci"})
        self.assertEqual(live_checks.ci_gate_status("3662", "."), "green")

    def test_required_red_is_failing(self):
        checks = (
            '[{"name": "req-ci", "state": "COMPLETED", "conclusion": "failure"},'
            ' {"name": "advisory", "state": "COMPLETED", "conclusion": "success"}]'
        )
        self._patch_checks(checks, {"req-ci"})
        self.assertEqual(live_checks.ci_gate_status("3662", "."), "failing")

    def test_required_none_is_legacy_all_checks_behavior(self):
        # Unresolved required set -> fail-closed legacy: any red still fails.
        checks = (
            '[{"name": "req-ci", "state": "COMPLETED", "conclusion": "success"},'
            ' {"name": "advisory", "state": "COMPLETED", "conclusion": "failure"}]'
        )
        self._patch_checks(checks, None)
        self.assertEqual(live_checks.ci_gate_status("3662", "."), "failing")


if __name__ == "__main__":
    unittest.main()
