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
