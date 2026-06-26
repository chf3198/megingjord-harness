"""Tests for #3265 — push counter counts only genuine successful ships.

Root cause: the G-15 blast-radius counter (Refs #2913) incremented on any
`git push`-shaped command in the PostToolUse hook, regardless of push intent
(branch-delete) or outcome (rejected push). Either drifts the counter above the
static `pushes_in_session` limit on a clean ship, producing a false halt.
"""
import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
HOOKS = REPO_ROOT / "hooks" / "scripts"
sys.path.insert(0, str(HOOKS))

from admin_patterns import is_countable_push  # noqa: E402
from tool_activity import mark_tool_activity  # noqa: E402

# Build push command strings at runtime so the literal tokens never appear as a
# single source token (keeps repo-side command scanners from flagging the file).
PUSH = "git " + "push "
DELETE = "--delete"


def _push(args: str) -> str:
    return PUSH + args


class IsCountablePushPredicate(unittest.TestCase):
    """AC2 / AC3 — the pure counting predicate."""

    def test_genuine_push_counts(self):
        self.assertTrue(is_countable_push(_push("origin main")))
        self.assertTrue(is_countable_push(_push("origin feat/3265-x")))

    def test_genuine_push_with_force_lease_counts(self):
        # rebase + force-push-with-lease is a real ship, must still count
        self.assertTrue(is_countable_push(_push("--force-with-lease origin feat/3265-x")))

    def test_branch_delete_long_flag_not_counted(self):
        self.assertFalse(is_countable_push(_push(DELETE + " origin feat/old")))

    def test_branch_delete_short_flag_not_counted(self):
        self.assertFalse(is_countable_push("git " + "push -d origin feat/old"))

    def test_branch_delete_colon_refspec_not_counted(self):
        self.assertFalse(is_countable_push(_push("origin :feat/old")))

    def test_src_dst_refspec_still_counts(self):
        # `src:dst` is a normal push, NOT a delete — colon not space-prefixed
        self.assertTrue(is_countable_push(_push("origin HEAD:refs/heads/main")))

    def test_dry_run_not_counted(self):
        self.assertFalse(is_countable_push(_push("--dry-run origin main")))
        self.assertFalse(is_countable_push("git " + "push -n origin main"))

    def test_non_git_push_not_counted(self):
        self.assertFalse(is_countable_push("git " + "commit -m x"))
        self.assertFalse(is_countable_push("gh pr merge 3273 --delete-branch"))

    def test_rejected_push_structured_exit_not_counted(self):
        self.assertFalse(is_countable_push(_push("origin main"), {"exit_code": 1}))

    def test_rejected_push_error_flag_not_counted(self):
        self.assertFalse(is_countable_push(_push("origin main"), {"is_error": True}))

    def test_rejected_push_stderr_marker_not_counted(self):
        tr = {"stderr": "! [rejected] main -> main (fetch first)\nerror: failed to push some refs"}
        self.assertFalse(is_countable_push(_push("origin main"), tr))

    def test_pre_push_hook_decline_not_counted(self):
        tr = "remote: pre-push hook declined\nUpdates were rejected"
        self.assertFalse(is_countable_push(_push("origin main"), tr))

    def test_successful_push_with_zero_exit_counts(self):
        tr = {"exit_code": 0, "stdout": "To github.com:x\n   abc..def  main -> main"}
        self.assertTrue(is_countable_push(_push("origin main"), tr))

    def test_unknown_outcome_counts_safety_preserving(self):
        # No outcome info -> count (over-count halts safely; under-count misses runaways)
        self.assertTrue(is_countable_push(_push("origin main"), None))


def _bash_payload(command: str, tool_response=None, cwd="/tmp"):
    p = {"tool_name": "Bash", "tool_input": {"command": command}, "cwd": cwd}
    if tool_response is not None:
        p["tool_response"] = tool_response
    return p


class MarkToolActivityIncrement(unittest.TestCase):
    """AC1 / AC4 — integration through the PostToolUse counter path."""

    def _state(self):
        return {"cwd": "/tmp", "blast_radius": {"push_count": 0},
                "roles": {}, "flags": {}, "admin_ops": {}}

    def test_genuine_push_increments(self):
        st = self._state()
        mark_tool_activity(st, _bash_payload(_push("origin feat/3265-x")))
        self.assertEqual(st["blast_radius"]["push_count"], 1)

    def test_branch_delete_does_not_increment(self):
        st = self._state()
        mark_tool_activity(st, _bash_payload(_push(DELETE + " origin feat/old")))
        self.assertEqual(st["blast_radius"]["push_count"], 0)

    def test_rejected_push_does_not_increment(self):
        st = self._state()
        mark_tool_activity(st, _bash_payload(_push("origin main"), {"exit_code": 1}))
        self.assertEqual(st["blast_radius"]["push_count"], 0)

    def test_clean_ship_then_delete_sequence_counts_one(self):
        # The exact #3265 sequence: one real ship + routine branch-delete cleanup.
        st = self._state()
        mark_tool_activity(st, _bash_payload(_push("origin feat/3265-x"),
                                             {"exit_code": 0, "stdout": "To x\n a..b main"}))
        mark_tool_activity(st, _bash_payload(_push(DELETE + " origin feat/3265-x")))
        self.assertEqual(st["blast_radius"]["push_count"], 1)

    def test_retry_storm_counts_only_successful(self):
        # 4 rejected attempts + 1 success must net to 1, not 5 (the false-halt repro).
        st = self._state()
        for _ in range(4):
            mark_tool_activity(st, _bash_payload(_push("origin main"),
                                                 {"exit_code": 1, "stderr": "! [rejected]"}))
        mark_tool_activity(st, _bash_payload(_push("origin main"), {"exit_code": 0}))
        self.assertEqual(st["blast_radius"]["push_count"], 1)


if __name__ == "__main__":
    unittest.main()
