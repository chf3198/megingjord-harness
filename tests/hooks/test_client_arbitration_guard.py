from __future__ import annotations

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

SCRIPTS = Path(__file__).resolve().parents[2] / "hooks" / "scripts"
sys.path.insert(0, str(SCRIPTS))

import client_arbitration_guard as guard  # noqa: E402


class TestClientArbitrationGuard(unittest.TestCase):
    def test_blocks_internal_conflict_arbitration_phrase(self):
        text = "Governance conflict in worktree drift. How would you like me to proceed?"
        self.assertEqual(guard.detect_client_arbitration(text), ["delegated-internal-conflict-decision-to-client"])

    def test_allows_design_or_uat_questions(self):
        text = "For design direction, which color palette do you prefer for this UI?"
        self.assertEqual(guard.detect_client_arbitration(text), [])

    # --- #3749 AC1: broadened detection beyond the conflict-keyword regex ---
    def test_broadened_flags_non_conflict_defer(self):
        # No governance/worktree/team/conflict keyword — the OLD narrow guard missed this.
        text = "I've found two viable implementations here. What should I do next?"
        self.assertEqual(
            guard.detect_client_arbitration(text),
            ["delegated-internal-conflict-decision-to-client"],
        )

    # --- #3749 AC3: the 4 carve-outs remain the sole escalation path ---
    def test_allows_irreversible_carveout(self):
        text = "This will permanently delete the production database. Which option should I take?"
        self.assertEqual(guard.detect_client_arbitration(text), [])

    def test_allows_security_weakening_carveout(self):
        text = "To unblock, I'd disable the merge gate protection. How would you like me to proceed?"
        self.assertEqual(guard.detect_client_arbitration(text), [])

    # --- #3749 AC4: anti-over-block — a routine non-decision clarification is not flagged ---
    def test_no_flag_on_routine_clarification(self):
        self.assertEqual(guard.detect_client_arbitration("Which file did you mean, a.js or b.js?"), [])

    # --- #3749 AC5: fail-safe — never raises, even on non-string / empty input ---
    def test_failsafe_on_bad_input(self):
        self.assertEqual(guard.detect_client_arbitration(""), [])
        self.assertEqual(guard.detect_client_arbitration(None), [])  # type: ignore[arg-type]

    # --- #3749 AC2: active redirect record names the decide() panel invocation ---
    def test_adjudication_redirect_record(self):
        text = "Governance conflict in worktree drift. How would you like me to proceed?"
        violations = guard.detect_client_arbitration(text)
        rec = guard.adjudication_redirect(text, violations)
        self.assertEqual(rec["route"], "adjudicate")
        self.assertFalse(rec["carveout"])
        self.assertEqual(rec["subclass"], "internal-conflict")
        self.assertIn("adjudication-guardrail", rec["directive"])
        self.assertIn(".decide(", rec["directive"])

    def test_redirect_subclass_general_for_non_conflict(self):
        text = "I've found two viable implementations here. What should I do next?"
        rec = guard.adjudication_redirect(text)
        self.assertEqual(rec["subclass"], "general-decision")

    def test_human_carveout_tiers(self):
        self.assertEqual(guard.human_carveout("pick the brand color"), "design-uat")
        self.assertEqual(guard.human_carveout("this is irreversible"), "irreversible")
        self.assertIsNone(guard.human_carveout("refactor the parser"))

    def test_classifies_sync_residue(self):
        conflict = guard.classify_internal_conflict([
            "scripts/global/post-merge-sweep.js",
            "wiki/concepts/agent-drift.md",
        ])
        self.assertEqual(conflict["type"], "sync-residue")
        self.assertTrue(any("git restore" in step for step in conflict["policy"]))

    def test_classifies_lease_collision(self):
        conflict = guard.classify_internal_conflict([".dashboard/cross-team-leases.json"])
        self.assertEqual(conflict["type"], "cross-team-lease-collision")

    def test_emits_incident(self):
        with tempfile.TemporaryDirectory() as td:
            home = Path(td)
            log = home / ".megingjord" / "incidents.jsonl"
            with patch.object(guard, "INCIDENTS_LOG", log):
                self.assertTrue(guard.emit_incident("test-pattern", ["e1"], "high"))
                self.assertTrue(log.is_file())
                row = json.loads(log.read_text(encoding="utf-8").strip())
                self.assertEqual(row["pattern_id"], "test-pattern")


if __name__ == "__main__":
    unittest.main()
