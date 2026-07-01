"""Branch-change state reset tests for #1975."""
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

REPO_ROOT = Path(__file__).resolve().parents[2]
HOOKS_SCRIPTS = REPO_ROOT / "hooks" / "scripts"
sys.path.insert(0, str(HOOKS_SCRIPTS))

import state_store  # noqa: E402


class BranchChangeReset(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.cwd = self.tmp.name
        self.state_dir = tempfile.TemporaryDirectory()
        self.patcher = patch.object(
            state_store, "state_root", return_value=Path(self.state_dir.name)
        )
        self.patcher.start()

    def tearDown(self):
        self.patcher.stop()
        self.tmp.cleanup()
        self.state_dir.cleanup()

    def _seed_dirty_state(self, branch: str) -> dict:
        state = state_store.ensure_state(self.cwd)
        state["active_branch"] = branch
        state["flags"]["code_touched"] = True
        state["admin_ops"]["commit"] = True
        state["admin_ops"]["push"] = True
        state["roles"]["collaborator"] = True
        state["drift"]["commits"] = 42
        state["routing"]["lane"] = "premium"
        state_store.save_state(state)
        return state

    def test_resets_flags_admin_ops_roles_on_branch_change(self):
        self._seed_dirty_state("feat/1000-prior")
        out = state_store.reset_on_branch_change(self.cwd, "fix/1975-stop-hook-state-persistence")
        self.assertFalse(out["flags"]["code_touched"])
        self.assertFalse(out["admin_ops"]["commit"])
        self.assertFalse(out["admin_ops"]["push"])
        self.assertFalse(out["roles"]["collaborator"])
        self.assertEqual(out["active_branch"], "fix/1975-stop-hook-state-persistence")

    def test_preserves_routing_and_drift(self):
        self._seed_dirty_state("feat/1000-prior")
        out = state_store.reset_on_branch_change(self.cwd, "fix/1975-other")
        self.assertEqual(out["drift"]["commits"], 42)
        self.assertEqual(out["routing"]["lane"], "premium")

    def test_no_reset_when_branch_matches(self):
        self._seed_dirty_state("feat/1000-prior")
        out = state_store.reset_on_branch_change(self.cwd, "feat/1000-prior")
        self.assertTrue(out["flags"]["code_touched"])
        self.assertTrue(out["admin_ops"]["commit"])

    def test_initial_call_sets_active_branch_without_reset(self):
        # First call after default state — active_branch is None — sets it
        state_store.ensure_state(self.cwd)
        out = state_store.reset_on_branch_change(self.cwd, "feat/9999-new")
        self.assertEqual(out["active_branch"], "feat/9999-new")
        self.assertFalse(out["flags"]["code_touched"])

    def test_none_branch_is_noop(self):
        self._seed_dirty_state("feat/1000-prior")
        out = state_store.reset_on_branch_change(self.cwd, None)
        self.assertTrue(out["flags"]["code_touched"])
        self.assertEqual(out["active_branch"], "feat/1000-prior")

    def test_default_state_has_active_branch_none(self):
        state = state_store._default_state(self.cwd)
        self.assertIn("active_branch", state)
        self.assertIsNone(state["active_branch"])

    def test_load_state_backfills_active_branch(self):
        # Simulate state file written before #1975 (no active_branch field)
        legacy = {"cwd": self.cwd, "repo_type": "generic",
                  "routing": {}, "current_phase": "manager",
                  "roles": {}, "flags": {}, "admin_ops": {}, "drift": {}}
        path = state_store.state_path(self.cwd)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(__import__("json").dumps(legacy))
        out = state_store.load_state(self.cwd)
        self.assertIn("active_branch", out)


class BranchChangeResetCommitPreservation(BranchChangeReset):
    """#3469: preserve admin_ops.commit across a branch change ONLY on real worktree evidence
    (a rebase / cwd-churn must not wipe the commit signal when a worktree holds a commit)."""

    def test_preserves_commit_when_worktree_ahead(self):
        self._seed_dirty_state("feat/1000-prior")
        with patch("worktree_push_gate.any_worktree_commit_ahead", return_value=True):
            out = state_store.reset_on_branch_change(self.cwd, "fix/3469-rebased")
        self.assertTrue(out["admin_ops"]["commit"], "commit signal preserved on real worktree evidence")
        # all other transient state is still reset
        self.assertFalse(out["flags"]["code_touched"])
        self.assertFalse(out["roles"]["collaborator"])
        self.assertEqual(out["active_branch"], "fix/3469-rebased")

    def test_does_not_preserve_commit_without_worktree_evidence(self):
        self._seed_dirty_state("feat/1000-prior")
        with patch("worktree_push_gate.any_worktree_commit_ahead", return_value=False):
            out = state_store.reset_on_branch_change(self.cwd, "fix/3469-other")
        self.assertFalse(out["admin_ops"]["commit"])

    def test_import_error_fails_safe_to_reset(self):
        # if worktree_push_gate cannot be imported, preservation is skipped (commit resets).
        self._seed_dirty_state("feat/1000-prior")
        with patch.dict("sys.modules", {"worktree_push_gate": None}):
            out = state_store.reset_on_branch_change(self.cwd, "fix/3469-noimport")
        self.assertFalse(out["admin_ops"]["commit"])


if __name__ == "__main__":
    unittest.main()
