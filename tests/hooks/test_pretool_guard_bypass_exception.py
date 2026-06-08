"""Unit tests for the #2706 admin-override bypass pre-flight guard in pretool_guard.

The guard denies an `--admin` override merge unless the Epic #2517 exception label
is already recorded on the active ticket. It is fail-open on internal error so a
guard bug can never brick a session.
"""
import os
import sys
import unittest

HOOKS = os.path.join(os.path.dirname(__file__), "..", "..", "hooks", "scripts")
sys.path.insert(0, os.path.abspath(HOOKS))

import pretool_guard  # noqa: E402

EXCEPTION = "merge-bypass:admin-exception"


class BypassExceptionGuard(unittest.TestCase):
    def setUp(self):
        self._orig = pretool_guard._active_ticket_labels

    def tearDown(self):
        pretool_guard._active_ticket_labels = self._orig

    def _labels(self, labels):
        pretool_guard._active_ticket_labels = lambda state, cwd: set(labels)

    def test_override_without_exception_is_blocked(self):
        self._labels({"type:task"})
        self.assertTrue(pretool_guard.require_bypass_exception("gh pr merge 5 --squash --admin", {}, "."))

    def test_override_with_exception_is_allowed(self):
        self._labels({"type:task", EXCEPTION})
        self.assertFalse(pretool_guard.require_bypass_exception("gh pr merge 5 --squash --admin", {}, "."))

    def test_non_override_merge_is_allowed(self):
        self._labels(set())
        self.assertFalse(pretool_guard.require_bypass_exception("gh pr merge 5 --squash", {}, "."))

    def test_override_detection_resists_flag_spacing_evasion(self):
        # the brittle substring check missed these; the regex catches them
        self._labels({"type:task"})
        for cmd in ("gh pr merge 5 --admin --delete-branch", "gh pr merge 5 --admin=true",
                    "gh pr merge 5 --admin\n"):
            self.assertTrue(pretool_guard.require_bypass_exception(cmd, {}, "."), cmd)

    def test_fail_closed_on_internal_error(self):
        def boom(state, cwd):
            raise RuntimeError("label backend down")
        pretool_guard._active_ticket_labels = boom
        # an override whose exception cannot be verified must DENY (fail-closed), never
        # silently bypass; the except prevents a crash so the session is not bricked
        self.assertTrue(pretool_guard.require_bypass_exception("gh pr merge 5 --admin", {}, "."))


if __name__ == "__main__":
    unittest.main()
