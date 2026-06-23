"""Operator phase self-heal on authoritative MANAGER_HANDOFF (#3206)."""
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

SCRIPTS = Path(__file__).resolve().parents[2] / "hooks" / "scripts"
sys.path.insert(0, str(SCRIPTS))

import pretool_guard  # noqa: E402


class TestOperatorPhaseSelfHeal(unittest.TestCase):
    def _run_first_edit(self, phase: str):
        state = {"flags": {}, "active_ticket": 3206, "current_phase": phase}
        saved = []

        def capture(decision, reason, extra=None):
            return decision, reason

        with patch("pretool_guard.emit", side_effect=capture), \
             patch("pretool_guard.active_ticket_is_no_code_lane", return_value=False), \
             patch("pretool_guard.is_main_checkout", return_value=False), \
             patch("pretool_guard.linked_issue_has_authoritative_manager_handoff", return_value=True), \
             patch("pretool_guard.linked_issue_has_planning_consensus", return_value=True), \
             patch("pretool_guard.save_state", side_effect=lambda s: saved.append(s["current_phase"])):
            pretool_guard.emit = capture
            flags = state.get("flags", {})
            cwd = "."
            if not flags.get("code_touched"):
                if not pretool_guard.linked_issue_has_authoritative_manager_handoff(cwd):
                    return pretool_guard.emit("deny", "missing mh")
                if state.get("current_phase") != "collaborator":
                    state["current_phase"] = "collaborator"
                    pretool_guard.save_state(state)
        return state.get("current_phase"), saved

    def test_manager_phase_promoted_on_authoritative_mh(self):
        phase, saved = self._run_first_edit("manager")
        self.assertEqual(phase, "collaborator")
        self.assertEqual(saved, ["collaborator"])

    def test_ready_phase_promoted_on_authoritative_mh(self):
        phase, saved = self._run_first_edit("ready")
        self.assertEqual(phase, "collaborator")
        self.assertEqual(saved, ["collaborator"])


if __name__ == "__main__":
    unittest.main()
