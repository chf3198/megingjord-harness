"""Tests for #2444: roles.admin auto-emits when all required admin_ops complete.

Closes hook gap where mark_tool_activity detected merge/push/etc. but never
flipped roles["admin"] = True, forcing operators to manually patch state
(which auto-mode classifier rightly blocks).
"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[2] / "hooks" / "scripts"
sys.path.insert(0, str(SCRIPTS))

from admin_patterns import required_admin_ops  # noqa: E402
from tool_activity import mark_tool_activity  # noqa: E402


class TestRequiredAdminOps(unittest.TestCase):
    """Unit: required_admin_ops returns the correct keyset per flags + repo."""

    def test_empty_when_no_code_touched(self):
        self.assertEqual(required_admin_ops({}, "generic"), [])
        self.assertEqual(required_admin_ops({"docs_touched": True}, "generic"), [])

    def test_base_when_code_touched(self):
        self.assertEqual(
            required_admin_ops({"code_touched": True}, "generic"),
            ["commit", "push", "pr_create", "ci_green", "merge"],
        )

    def test_vscode_extension_adds_publish_steps(self):
        result = required_admin_ops(
            {"code_touched": True, "extension_touched": True},
            "vscode-extension",
        )
        for required_step in ("commit", "push", "merge", "publish", "release_integrity", "gh_release"):
            self.assertIn(required_step, result)

    def test_ui_touched_adds_visual_qa(self):
        result = required_admin_ops(
            {"code_touched": True, "ui_touched": True}, "generic",
        )
        self.assertIn("visual_qa", result)

    def test_extension_only_in_vscode_repo(self):
        """extension_touched without vscode-extension repo_type does NOT add publish."""
        result = required_admin_ops(
            {"code_touched": True, "extension_touched": True}, "generic",
        )
        self.assertNotIn("publish", result)


class TestMarkToolActivityRoleEmit(unittest.TestCase):
    """Integration: mark_tool_activity flips roles.admin at completion."""

    def _state(self, repo_type="generic"):
        return {
            "repo_type": repo_type,
            "roles": {"collaborator": True},
            "flags": {"code_touched": True},
            "admin_ops": {},
        }

    def _bash_payload(self, command: str):
        return {"tool_name": "Bash", "tool_input": {"command": command}}

    def test_no_flip_until_all_ops_complete(self):
        state = self._state()
        mark_tool_activity(state, self._bash_payload("git commit -m foo"))
        self.assertTrue(state["admin_ops"].get("commit"))
        self.assertFalse(state["roles"].get("admin"))

    def test_flips_admin_after_full_baton(self):
        state = self._state()
        for command in (
            "git commit -m foo",
            "git push -u origin foo",
            "gh pr create --title bar",
            "gh pr checks 99",
            "gh pr merge 99",
        ):
            mark_tool_activity(state, self._bash_payload(command))
        self.assertTrue(state["roles"].get("admin"),
                        "roles.admin should auto-emit when all base ops complete")

    def test_no_flip_when_pr_create_missing(self):
        state = self._state()
        for command in (
            "git commit -m foo",
            "git push -u origin foo",
            "gh pr checks 99",
            "gh pr merge 99",
        ):
            mark_tool_activity(state, self._bash_payload(command))
        self.assertFalse(state["roles"].get("admin"))

    def test_vscode_extension_needs_publish_steps(self):
        state = self._state(repo_type="vscode-extension")
        state["flags"]["extension_touched"] = True
        for command in (
            "git commit -m foo",
            "git push -u origin foo",
            "gh pr create --title bar",
            "gh pr checks 99",
            "gh pr merge 99",
        ):
            mark_tool_activity(state, self._bash_payload(command))
        self.assertFalse(state["roles"].get("admin"),
                         "vscode-extension needs publish/release_integrity/gh_release too")
        for command in (
            "npx vsce publish",
            "release-integrity-check.sh --post-publish",
            "gh release create v1.0.0",
        ):
            mark_tool_activity(state, self._bash_payload(command))
        self.assertTrue(state["roles"].get("admin"))

    def test_no_flip_without_code_touched(self):
        """Docs-only sessions should not auto-emit admin."""
        state = {
            "repo_type": "generic",
            "roles": {"collaborator": True},
            "flags": {"docs_touched": True},  # no code_touched
            "admin_ops": {},
        }
        for command in (
            "git commit -m doc",
            "git push -u origin doc",
            "gh pr create --title doc",
            "gh pr checks 99",
            "gh pr merge 99",
        ):
            mark_tool_activity(state, self._bash_payload(command))
        self.assertFalse(state["roles"].get("admin"))


if __name__ == "__main__":
    unittest.main()
