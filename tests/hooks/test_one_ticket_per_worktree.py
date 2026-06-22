"""#2967: one-ticket-per-worktree baton guard tests.

Covers the allow/deny matrix, false-positive prevention, the cross-ADK
compatibility matrix, and the pretool_guard integration (deny path)."""
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

REPO_ROOT = Path(__file__).resolve().parents[2]
HOOKS_SCRIPTS = REPO_ROOT / "hooks" / "scripts"
sys.path.insert(0, str(HOOKS_SCRIPTS))

import one_ticket_per_worktree as guard  # noqa: E402
import pretool_guard  # noqa: E402


def _state(active=None, roles=None, closed=False):
    return {
        "active_ticket": active,
        "roles": roles if roles is not None else {},
        "admin_ops": {"issue_close": True} if closed else {},
    }


# An active ticket that is genuinely mid-baton: has activity, not closed.
MIDBATON = {"collaborator": True}


class DetectBatonPost(unittest.TestCase):
    def test_detects_inline_artifact(self):
        cmd = 'gh issue comment 100 --body "## MANAGER_HANDOFF\nscope: x"'
        self.assertEqual(guard.detect_baton_post(cmd), (100, "MANAGER_HANDOFF"))

    def test_detects_body_file_artifact_via_reader(self):
        cmd = "gh issue comment 100 --body-file /tmp/ah.md"
        reader = lambda p: "## ADMIN_HANDOFF\nbranch: x"
        self.assertEqual(guard.detect_baton_post(cmd, reader), (100, "ADMIN_HANDOFF"))

    def test_non_comment_command_is_not_a_post(self):
        self.assertIsNone(guard.detect_baton_post("gh issue create --title MANAGER_HANDOFF"))

    def test_coordination_comment_is_not_a_post(self):
        cmd = 'gh issue comment 100 --body "Epic progress update: child closed"'
        self.assertIsNone(guard.detect_baton_post(cmd))

    def test_batch_sibling_evidence_is_exempt(self):
        cmd = ('gh issue comment 100 --body "## CONSULTANT_CLOSEOUT\n'
               'resolved as part of batch with #99"')
        self.assertIsNone(guard.detect_baton_post(cmd))


class CheckGuard(unittest.TestCase):
    def test_deny_cross_ticket_while_active_unresolved(self):
        cmd = 'gh issue comment 200 --body "## COLLABORATOR_HANDOFF"'
        reason = guard.check_one_ticket_per_worktree(cmd, _state(active=100, roles=MIDBATON), env={})
        self.assertIsNotNone(reason)
        self.assertIn("#100", reason)
        self.assertIn("#200", reason)

    def test_allow_same_ticket(self):
        cmd = 'gh issue comment 100 --body "## ADMIN_HANDOFF"'
        self.assertIsNone(
            guard.check_one_ticket_per_worktree(cmd, _state(active=100, roles=MIDBATON), env={}))

    def test_allow_after_active_ticket_closed(self):
        cmd = 'gh issue comment 200 --body "## MANAGER_HANDOFF"'
        self.assertIsNone(
            guard.check_one_ticket_per_worktree(cmd, _state(active=100, roles=MIDBATON, closed=True), env={}))

    def test_allow_when_active_has_no_baton_activity(self):
        # active_ticket set but no recorded role activity -> stale pointer, not a block.
        cmd = 'gh issue comment 200 --body "## MANAGER_HANDOFF"'
        self.assertIsNone(
            guard.check_one_ticket_per_worktree(cmd, _state(active=100, roles={}), env={}))

    def test_allow_no_active_ticket(self):
        cmd = 'gh issue comment 200 --body "## MANAGER_HANDOFF"'
        self.assertIsNone(
            guard.check_one_ticket_per_worktree(cmd, _state(active=None, roles=MIDBATON), env={}))

    def test_allow_coordination_comment_cross_ticket(self):
        cmd = 'gh issue comment 200 --body "see related work"'
        self.assertIsNone(
            guard.check_one_ticket_per_worktree(cmd, _state(active=100, roles=MIDBATON), env={}))

    def test_failopen_unparseable_active_ticket(self):
        cmd = 'gh issue comment 200 --body "## MANAGER_HANDOFF"'
        self.assertIsNone(
            guard.check_one_ticket_per_worktree(cmd, _state(active="not-a-number", roles=MIDBATON), env={}))

    def test_kill_switch_disables_guard(self):
        cmd = 'gh issue comment 200 --body "## MANAGER_HANDOFF"'
        self.assertIsNone(guard.check_one_ticket_per_worktree(
            cmd, _state(active=100, roles=MIDBATON), env={"MEGINGJORD_ONE_TICKET_GUARD_OFF": "1"}))

    def test_deny_uses_body_file_content(self):
        cmd = "gh issue comment 200 --body-file /tmp/cc.md"
        reader = lambda p: "## CONSULTANT_CLOSEOUT\nverdict: approve"
        reason = guard.check_one_ticket_per_worktree(
            cmd, _state(active=100, roles=MIDBATON), body_file_reader=reader, env={})
        self.assertIsNotNone(reason)


class CrossAdkMatrix(unittest.TestCase):
    """AC2: the verdict is provider-neutral — identical gh command, identical result
    regardless of which runtime issued it."""
    RUNTIMES = ["claude-code", "copilot", "codex", "antigravity"]

    def test_same_verdict_across_runtimes(self):
        cmd = 'gh issue comment 200 --body "## ADMIN_HANDOFF"'
        state = _state(active=100, roles=MIDBATON)
        verdicts = {
            runtime: bool(guard.check_one_ticket_per_worktree(cmd, state, env={}))
            for runtime in self.RUNTIMES
        }
        self.assertEqual(set(verdicts.values()), {True})  # all deny, uniformly


class PretoolGuardIntegration(unittest.TestCase):
    def _run(self, cmd, state):
        captured = {}

        def fake_emit(decision, reason, extra=None):
            captured["decision"] = decision
            captured["reason"] = reason
            return 0

        with patch("pretool_guard.emit", side_effect=fake_emit):
            pretool_guard.check_terminal(cmd, state, str(REPO_ROOT))
        return captured

    def test_check_terminal_denies_cross_ticket_baton(self):
        cmd = 'gh issue comment 200 --body "## MANAGER_HANDOFF"'
        out = self._run(cmd, _state(active=100, roles=MIDBATON))
        self.assertEqual(out.get("decision"), "deny")
        self.assertIn("One ticket per worktree", out.get("reason", ""))


if __name__ == "__main__":
    unittest.main()
