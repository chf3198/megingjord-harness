"""Unit tests for the Epic #3392 AC2 ask-surface remediation in pretool_guard.

The 5 operator-resolvable surfaces (S1 raw-fleet-curl, S2 gh-issue-close-pre-normalize,
S3 PR-before-commit, S4 CI-before-PR, S5 integrity-before-publish) must NO LONGER emit
`permissionDecision: "ask"` (which overrides bypass mode and interrupts the client). They
self-resolve via a redirect (deny) or a state-derived allow. The 2 security-sensitive
surfaces (S6 hook-mutation, S7 sensitive-path) are out of scope (handled by #3403) and MUST
still ask — that guards the anti-goal regression boundary.
"""
import io
import json
import os
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from unittest import mock

HOOKS = os.path.join(os.path.dirname(__file__), "..", "..", "hooks", "scripts")
sys.path.insert(0, os.path.abspath(HOOKS))

import pretool_guard  # noqa: E402


def _decision(joined, state=None, cwd=None):
    """Run check_terminal and return the emitted permissionDecision (or None)."""
    state = state or {"flags": {}, "admin_ops": {}, "repo_type": "generic", "active_ticket": None}
    cwd = cwd or tempfile.gettempdir()
    buf = io.StringIO()
    # Isolate the surface under test: neutralize the earlier sub-gates that make live calls.
    with mock.patch.object(pretool_guard, "_check_auth_profile", return_value=None), \
         mock.patch.object(pretool_guard, "_check_role_tool_allowlist", return_value=None), \
         mock.patch.object(pretool_guard, "_check_epic_close_guard", return_value=None), \
         mock.patch.object(pretool_guard, "active_ticket_is_no_code_lane", return_value=False), \
         mock.patch.object(pretool_guard, "check_one_ticket_per_worktree", return_value=None), \
         redirect_stdout(buf):
        pretool_guard.check_terminal(joined, state, cwd)
    out = buf.getvalue().strip()
    if not out:
        return None
    return json.loads(out)["hookSpecificOutput"]["permissionDecision"]


class AskRemediation(unittest.TestCase):
    def test_s1_raw_fleet_curl_denies_not_asks(self):
        d = _decision("curl -s http://100.91.113.16:11434/api/generate -d @r.json")
        self.assertEqual(d, "deny")

    def test_s1_keeps_bypass_carveout(self):
        # The '# hamr-bypass-ok' carve-out is preserved — no deny, falls through.
        d = _decision("curl http://host:11434/api/generate  # hamr-bypass-ok: diagnostic")
        self.assertNotEqual(d, "ask")
        self.assertNotEqual(d, "deny")

    def test_s2_issue_close_pre_normalize_denies_not_asks(self):
        d = _decision("gh issue close 123")
        self.assertEqual(d, "deny")

    def test_s2_close_with_normalize_is_allowed(self):
        # Already normalizing → no ask, no deny (falls through).
        d = _decision("gh issue edit 123 --remove-label role:admin && gh issue close 123")
        self.assertNotIn(d, ("ask", "deny"))

    def test_s3_pr_before_commit_allows_when_commit_ahead(self):
        with mock.patch.object(pretool_guard, "linked_issue_has_collab_handoff", return_value=True), \
             mock.patch("worktree_push_gate.branch_has_commit_ahead", return_value=True):
            d = _decision("gh pr create --fill")
        self.assertEqual(d, "allow")

    def test_s3_pr_before_commit_denies_when_no_commit(self):
        with mock.patch.object(pretool_guard, "linked_issue_has_collab_handoff", return_value=True), \
             mock.patch("worktree_push_gate.branch_has_commit_ahead", return_value=False):
            d = _decision("gh pr create --fill")
        self.assertEqual(d, "deny")

    def test_s4_ci_before_pr_allows_not_asks(self):
        d = _decision("gh pr checks 3418")
        self.assertEqual(d, "allow")

    def test_s5_integrity_before_publish_allows_not_asks(self):
        state = {"flags": {}, "admin_ops": {}, "repo_type": "vscode-extension", "active_ticket": None}
        with mock.patch.object(pretool_guard, "RE_RELEASE_INTEGRITY", __import__("re").compile(r"release-integrity")):
            d = _decision("npm run release-integrity", state=state)
        self.assertEqual(d, "allow")

    def test_no_remediated_surface_emits_ask(self):
        # None of the 5 remediated commands may emit ask.
        for cmd in ("curl http://h:11434/api/tags", "gh issue close 9", "gh pr checks 9"):
            self.assertNotEqual(_decision(cmd), "ask", f"{cmd!r} still asks")


class AntiGoalBoundaryPreserved(unittest.TestCase):
    """S6 (hook mutation) and S7 (sensitive path) MUST still ask — #3403 scope, not #3402."""

    def test_s6_hook_mutation_still_asks(self):
        from runtime_paths import runtime_hook_paths
        markers = runtime_hook_paths()
        if not markers:
            self.skipTest("no runtime hook markers in this environment")
        d = _decision(f"echo x >> {markers[0]}")
        self.assertEqual(d, "ask")


if __name__ == "__main__":
    unittest.main()
