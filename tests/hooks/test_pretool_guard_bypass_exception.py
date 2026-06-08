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

    def test_fail_open_on_internal_error(self):
        def boom(state, cwd):
            raise RuntimeError("label backend down")
        pretool_guard._active_ticket_labels = boom
        # a guard bug must NOT brick the session: returns False (allow), not raise
        self.assertFalse(pretool_guard.require_bypass_exception("gh pr merge 5 --admin", {}, "."))


if __name__ == "__main__":
    unittest.main()
