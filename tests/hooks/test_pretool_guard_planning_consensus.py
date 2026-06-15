"""Pretool first-edit planning-consensus gate tests (#2971)."""
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = REPO_ROOT / "hooks" / "scripts"
sys.path.insert(0, str(SCRIPTS))

import pretool_guard  # noqa: E402


class TestPretoolPlanningConsensusGate(unittest.TestCase):
    def setUp(self):
        self._emit = pretool_guard.emit
        pretool_guard.emit = lambda decision, reason, extra=None: (decision, reason)

    def tearDown(self):
        pretool_guard.emit = self._emit

    def _run_first_edit(self, consensus_ok: bool, override: bool = False):
        state = {"active_ticket": 2971, "flags": {"code_touched": False}}
        cwd = str(REPO_ROOT)
        with patch("pretool_guard.linked_issue_has_manager_handoff", return_value=True), \
             patch("pretool_guard.linked_issue_has_planning_consensus", return_value=consensus_ok), \
             patch("pretool_guard._emit_planning_consensus_override_incident", return_value=None):
            if override:
                os.environ[pretool_guard.CONSENSUS_OVERRIDE_ENV] = "1"
            else:
                os.environ.pop(pretool_guard.CONSENSUS_OVERRIDE_ENV, None)
            if not state["flags"].get("code_touched"):
                if not pretool_guard.linked_issue_has_manager_handoff(cwd):
                    return pretool_guard.emit("deny", "missing manager")
                if not pretool_guard.linked_issue_has_planning_consensus(cwd):
                    if os.environ.get(pretool_guard.CONSENSUS_OVERRIDE_ENV) == "1":
                        pretool_guard._emit_planning_consensus_override_incident(cwd, state.get("active_ticket"))
                        return pretool_guard.emit("allow", "Planning-consensus override accepted. Incident recorded for audit.")
                    return pretool_guard.emit("deny", "File edit blocked: planning consensus >=93 is not verified.")
            return None

    def test_denies_first_edit_without_consensus(self):
        result = self._run_first_edit(consensus_ok=False)
        self.assertEqual(result[0], "deny")
        self.assertIn("planning consensus", result[1])

    def test_allows_override_when_enabled(self):
        result = self._run_first_edit(consensus_ok=False, override=True)
        self.assertEqual(result[0], "allow")

    def test_allows_when_consensus_present(self):
        result = self._run_first_edit(consensus_ok=True)
        self.assertIsNone(result)


if __name__ == "__main__":
    unittest.main()
