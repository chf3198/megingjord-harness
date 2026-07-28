"""Stop-hook Admin-op docs-lane exemption (#3569).

Generalizes the #3266 research-lane Stop-gate exemption to lane:docs-research / lane:docs-only.
`required_admin_ops(..., report_only_clean_exempt=True)` returns [] and
`check_admin_ops(..., report_only_clean_exempt=True)` never blocks — a clean report-only session
is PR-less/merge-less by design, so a lingering code_touched flag must not manufacture a phantom
Admin obligation. lane:code-change behaviour is unchanged. The docs-lane predicate that feeds the
exemption (AC1) is covered in test_pretool_guard_docs_lane.py.
"""
import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
HOOKS_SCRIPTS = REPO_ROOT / "hooks" / "scripts"
sys.path.insert(0, str(HOOKS_SCRIPTS))

from admin_patterns import required_admin_ops  # noqa: E402
from stop_checks import check_admin_ops  # noqa: E402

FULL = ["commit", "push", "pr_create", "ci_green", "merge"]


class RequiredAdminOpsExempt(unittest.TestCase):
    def test_AC5_code_change_unchanged(self):
        # Default (no exemption): a code-touched session still requires the full admin list.
        self.assertEqual(required_admin_ops({"code_touched": True}, "generic"), FULL)

    def test_AC4_report_only_exempt_zero_ops(self):
        # Even with a stale code_touched flag, the clean docs/report-only exemption requires ZERO ops.
        self.assertEqual(
            required_admin_ops({"code_touched": True}, "generic", report_only_clean_exempt=True), [])

    def test_AC4_report_only_exempt_suppresses_extension_ops(self):
        flags = {"code_touched": True, "extension_touched": True, "ui_touched": True}
        self.assertEqual(
            required_admin_ops(flags, "vscode-extension", report_only_clean_exempt=True), [])


class CheckAdminOpsExempt(unittest.TestCase):
    def test_AC4_clean_report_only_no_block(self):
        # collaborator done, stale code_touched, no admin ops, but exempt -> no block.
        reason, _ = check_admin_ops(
            {"code_touched": True}, {}, {"collaborator": True}, "generic",
            uncommitted=None, report_only_clean_exempt=True)
        self.assertIsNone(reason)

    def test_AC5_code_change_blocks_without_exempt(self):
        # Same state, NOT exempt (e.g. lane:code-change) -> hard governance block persists.
        reason, _ = check_admin_ops(
            {"code_touched": True}, {}, {"collaborator": True}, "generic",
            uncommitted=None, report_only_clean_exempt=False)
        self.assertIsNotNone(reason)
        self.assertIn("missing Admin steps", reason)


if __name__ == "__main__":
    unittest.main()
