"""#3054: Stop-hook coupling — ADMIN_HANDOFF denied unless merged OR exception.

Tests that check_admin_ops blocks when merge is missing and passes when a
documented merge exception (merge-evidence-override, baseline-drift) is set.
Offline-graceful: reads local admin_ops only.
"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[2] / "hooks" / "scripts"
sys.path.insert(0, str(SCRIPTS))

from stop_checks import check_admin_ops, _merge_exception_active  # noqa: E402


class TestMergeExceptionActive(unittest.TestCase):
    """Unit tests for the _merge_exception_active helper."""

    def test_no_exception(self):
        self.assertFalse(_merge_exception_active({}))

    def test_merge_evidence_override(self):
        self.assertTrue(_merge_exception_active({"merge_evidence_override": True}))

    def test_baseline_drift_override(self):
        self.assertTrue(_merge_exception_active({"baseline_drift_override": True}))

    def test_false_flag_ignored(self):
        self.assertFalse(_merge_exception_active({"merge_evidence_override": False}))


class TestCheckAdminOpsMergeCoupling(unittest.TestCase):
    """check_admin_ops couples ADMIN_HANDOFF to merge (#3054)."""

    _BASE_FLAGS = {"code_touched": True}
    _BASE_ROLES = {"collaborator": True, "admin": True}

    def _ops(self, **overrides):
        ops = {"commit": True, "push": True, "pr_create": True, "ci_green": True}
        ops.update(overrides)
        return ops

    def test_blocks_when_merge_missing(self):
        """Missing merge → blocked."""
        ops = self._ops()  # no merge key
        reason, msg = check_admin_ops(self._BASE_FLAGS, ops, self._BASE_ROLES, "generic")
        self.assertIsNotNone(reason)
        self.assertIn("merge", reason)

    def test_passes_when_merged(self):
        """merge=True → passes."""
        ops = self._ops(merge=True)
        reason, _ = check_admin_ops(self._BASE_FLAGS, ops, self._BASE_ROLES, "generic")
        self.assertIsNone(reason)

    def test_merge_evidence_override_satisfies(self):
        """merge_evidence_override exception satisfies the merge step."""
        ops = self._ops(merge_evidence_override=True)
        reason, _ = check_admin_ops(self._BASE_FLAGS, ops, self._BASE_ROLES, "generic")
        self.assertIsNone(reason)

    def test_baseline_drift_override_satisfies(self):
        """baseline_drift_override exception satisfies the merge step."""
        ops = self._ops(baseline_drift_override=True)
        reason, _ = check_admin_ops(self._BASE_FLAGS, ops, self._BASE_ROLES, "generic")
        self.assertIsNone(reason)

    def test_exception_only_covers_merge(self):
        """Exception covers merge but not other missing ops."""
        ops = {"commit": True, "push": True, "merge_evidence_override": True}
        # pr_create and ci_green still missing
        reason, _ = check_admin_ops(self._BASE_FLAGS, ops, self._BASE_ROLES, "generic")
        self.assertIsNotNone(reason)
        self.assertIn("pr_create", reason)

    def test_no_collaborator_role_skips(self):
        """Pre-collaborator phase: no check (phase guard)."""
        roles = {"collaborator": False}
        ops = {}
        reason, _ = check_admin_ops(self._BASE_FLAGS, ops, roles, "generic")
        self.assertIsNone(reason)


if __name__ == "__main__":
    unittest.main()
