"""#2586/#2587 — worktree-correct + repo-scoped active-ticket gate.

Unit-tests the path->governed-worktree->ticket resolver and the pretool_guard
decision across all four runtime payload shapes (Epic #2585 contract).
"""
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "hooks" / "scripts"))

import pretool_guard  # noqa: E402
import worktree_ticket as wt  # noqa: E402


class TicketFromBranch(unittest.TestCase):
    def test_forms(self):
        self.assertEqual(wt.ticket_from_branch("fix/2564-baton"), 2564)
        self.assertEqual(wt.ticket_from_branch("feat/2586-a-b"), 2586)
        self.assertEqual(wt.ticket_from_branch("#2564-x"), 2564)
        self.assertEqual(wt.ticket_from_branch("2564-x"), 2564)

    def test_non_conforming_yields_none(self):
        for b in ["main", "dependabot/npm/zod-1.2.3", "", None, "HEAD", "release-please"]:
            self.assertIsNone(wt.ticket_from_branch(b))


def _decide(payload, *, derived, governed):
    """Run pretool_guard.main() over payload, capturing the emitted decision."""
    captured = {}

    def fake_emit(decision, reason, extra=None):
        captured["decision"] = decision
        return 0

    with patch("pretool_guard.emit", side_effect=fake_emit), \
         patch("pretool_guard.is_main_checkout", return_value=False), \
         patch("pretool_guard.current_branch", return_value=None), \
         patch("pretool_guard.ensure_state", return_value={}), \
         patch("state_store.reset_on_branch_change", return_value={}), \
         patch("worktree_ticket.resolve_ticket_from_paths", return_value=derived), \
         patch("worktree_ticket.any_path_in_governed_repo", return_value=governed), \
         patch("sys.stdin") as stdin:
        stdin.read.return_value = json.dumps(payload)
        pretool_guard.main()
    return captured.get("decision")  # None == allowed (no deny emitted)


# Each runtime carries the edited path under a different key.
RUNTIME_PAYLOADS = {
    "claude": {"tool_name": "Edit", "tool_input": {"file_path": "/home/u/devenv-ops-2586/a.py"}},
    "antigravity": {"tool_name": "write_to_file", "tool_input": {"TargetFile": "/home/u/devenv-ops-2586/a.py"}},
    "codex": {"tool_name": "apply_patch", "tool_input": {"file_path": "/home/u/devenv-ops-2586/a.py"}},
    "copilot": {"tool_name": "replace_string_in_file", "tool_input": {"filePath": "/home/u/devenv-ops-2586/a.py"}},
}


class GateDecisionParity(unittest.TestCase):
    def test_finding1_path_derived_allows_across_runtimes(self):
        # No active ticket, but the path's worktree branch yields one -> allow.
        for rt, payload in RUNTIME_PAYLOADS.items():
            self.assertIsNone(_decide(payload, derived=2586, governed=True),
                              f"{rt}: derived ticket should allow")

    def test_finding2_outside_repo_allows_across_runtimes(self):
        # No active ticket, no derived ticket, path outside any governed repo -> allow.
        for rt, payload in RUNTIME_PAYLOADS.items():
            self.assertIsNone(_decide(payload, derived=None, governed=False),
                              f"{rt}: out-of-repo edit should allow")

    def test_status_quo_deny_in_repo_without_ticket(self):
        # No active ticket, no derived ticket, path inside a governed repo -> deny.
        for rt, payload in RUNTIME_PAYLOADS.items():
            self.assertEqual(_decide(payload, derived=None, governed=True), "deny",
                             f"{rt}: in-repo edit w/o ticket must still deny")

    def test_empty_paths_fail_safe_deny(self):
        payload = {"tool_name": "Edit", "tool_input": {}}
        self.assertEqual(_decide(payload, derived=None, governed=False), "deny",
                         "no resolvable path -> fail safe to status-quo deny")


if __name__ == "__main__":
    unittest.main()
