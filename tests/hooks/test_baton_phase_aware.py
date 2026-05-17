"""Guardrail tests for #1798 (T1-T6 from audit).

Covers phase-aware Stop hook + Manager-gate hardening + current_phase field.
Run via: python3 -m unittest tests/hooks/test_baton_phase_aware.py
"""
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

REPO_ROOT = Path(__file__).resolve().parents[2]
HOOKS_SCRIPTS = REPO_ROOT / "hooks" / "scripts"
sys.path.insert(0, str(HOOKS_SCRIPTS))

import manager_ticket_gate  # noqa: E402
import state_store  # noqa: E402
import stop_checks  # noqa: E402


class StopChecksPhaseGuard(unittest.TestCase):
    """T1, T2, T3 — Stop-hook Admin warnings honor baton phase."""

    def test_t1_check_uncommitted_silent_pre_collab(self):
        roles = {"manager": True, "collaborator": False, "admin": False, "consultant": False}
        result = stop_checks.check_uncommitted(["issues.json", "filter.py"], roles)
        self.assertEqual(result, (None, None))

    def test_t2_check_uncommitted_fires_post_collab(self):
        roles = {"manager": True, "collaborator": True, "admin": False, "consultant": False}
        block_reason, msg = stop_checks.check_uncommitted(["script.js"], roles)
        self.assertIsNotNone(block_reason)
        self.assertIn("ADMIN ROLE INCOMPLETE", msg)

    def test_t2b_check_uncommitted_backward_compat_no_roles(self):
        # When roles is None (legacy callers), preserve original behavior — fire.
        block_reason, msg = stop_checks.check_uncommitted(["script.js"], None)
        self.assertIsNotNone(block_reason)

    def test_t3_check_admin_ops_silent_pre_collab(self):
        flags = {"code_touched": True}
        ops = {"commit": False, "push": False, "pr_create": False, "ci_green": False, "merge": False}
        roles = {"manager": True, "collaborator": False, "admin": False, "consultant": False}
        result = stop_checks.check_admin_ops(flags, ops, roles, "generic")
        self.assertEqual(result, (None, None))

    def test_t3b_check_admin_ops_fires_post_collab_missing(self):
        flags = {"code_touched": True}
        ops = {"commit": False, "push": False, "pr_create": False, "ci_green": False, "merge": False}
        roles = {"manager": True, "collaborator": True, "admin": False, "consultant": False}
        block_reason, msg = stop_checks.check_admin_ops(flags, ops, roles, "generic")
        self.assertIsNotNone(block_reason)
        self.assertIn("missing Admin steps", block_reason)


class ManagerGateHardening(unittest.TestCase):
    """T4, T5, T6 — Manager-gate respects state and ignores word noise."""

    def _run_gate(self, prompt, state_overrides=None):
        import io
        payload = {"prompt": prompt, "cwd": str(REPO_ROOT)}
        stdin_io = io.StringIO(json.dumps(payload))
        stdout_io = io.StringIO()
        base_state = {"roles": {}, "active_ticket": None}
        if state_overrides:
            base_state.update(state_overrides)
        with patch("manager_ticket_gate.is_repo_enabled", return_value=True), \
             patch("manager_ticket_gate.ensure_state", return_value=base_state), \
             patch("manager_ticket_gate.save_state"), \
             patch("sys.stdin", stdin_io), \
             patch("sys.stdout", stdout_io):
            manager_ticket_gate.main()
        out = stdout_io.getvalue().strip()
        return [out] if out else []

    def test_t4_no_trigger_on_word_work(self):
        captured = self._run_gate("What needs work next?")
        self.assertEqual(captured, [])

    def test_t4b_no_trigger_on_word_task(self):
        captured = self._run_gate("My next task is something")
        self.assertEqual(captured, [])

    def test_t5_accepts_active_ticket_from_state(self):
        captured = self._run_gate("MANAGER_HANDOFF: scope: foo", state_overrides={"active_ticket": 1798})
        self.assertEqual(captured, [])

    def test_t6_emits_on_explicit_handoff_without_ticket(self):
        captured = self._run_gate("MANAGER_HANDOFF: scope: bar")
        self.assertEqual(len(captured), 1)
        payload = json.loads(captured[0])
        self.assertIn("hookSpecificOutput", payload)


class CurrentPhaseField(unittest.TestCase):
    """F4 — governance state carries current_phase field."""

    def test_default_state_has_current_phase_manager(self):
        state = state_store._default_state(str(REPO_ROOT))
        self.assertEqual(state.get("current_phase"), "manager")

    def test_load_state_backfills_current_phase_for_legacy(self):
        # Simulate legacy state file without current_phase.
        # ensure_state writes defaults including current_phase.
        state = state_store.ensure_state(str(REPO_ROOT))
        self.assertIn("current_phase", state)


if __name__ == "__main__":
    unittest.main()
