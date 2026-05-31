"""Tests for #2471: Antigravity-signer advisory guard."""
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

import antigravity_signer_guard as guard  # noqa: E402


class TestFeatureFlag(unittest.TestCase):
    def test_disabled_by_default(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("MEGINGJORD_ANTIGRAVITY_GUARD", None)
            self.assertFalse(guard.feature_enabled())

    def test_check_returns_guard_disabled_when_off(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("MEGINGJORD_ANTIGRAVITY_GUARD", None)
            result = guard.check_commit_message("anything", branch="main")
            self.assertTrue(result["allow"])
            self.assertEqual(result["reason"], "guard-disabled")


class TestSignerDetection(unittest.TestCase):
    def test_detects_antigravity_team(self):
        msg = """feat: foo

Team&Model: antigravity:gemini-2.0-pro@google
Role: collaborator
Signed-by: Apollo Harper
"""
        self.assertTrue(guard.is_antigravity_signed(msg))

    def test_detects_team_model_with_hyphen(self):
        msg = "AI-Team-Model: antigravity:gemini-2.0-pro@google"
        self.assertTrue(guard.is_antigravity_signed(msg))

    def test_ignores_non_antigravity(self):
        msg = "Team&Model: claude-code:opus-4-7@local"
        self.assertFalse(guard.is_antigravity_signed(msg))

    def test_extract_signer_alias(self):
        msg = "Signed-by: Apollo Harper\nRole: collaborator"
        self.assertEqual(guard.extract_signer_alias(msg), "Apollo Harper")

    def test_extract_signer_returns_none_when_absent(self):
        self.assertIsNone(guard.extract_signer_alias("no signer line"))


class TestAdvisoryBehavior(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.orig_path = guard.INCIDENTS_PATH
        guard.INCIDENTS_PATH = Path(self.tmp.name) / "incidents.jsonl"

    def tearDown(self):
        guard.INCIDENTS_PATH = self.orig_path
        self.tmp.cleanup()

    def test_advisory_only_never_blocks(self):
        msg = "Team&Model: antigravity:gemini-2.0-pro@google\nSigned-by: Apollo Harper"
        with patch.dict(os.environ, {"MEGINGJORD_ANTIGRAVITY_GUARD": "1"}):
            result = guard.check_commit_message(msg, branch="main")
            self.assertTrue(result["allow"], "Tier B++: must not block")
            self.assertTrue(result["advisory"])

    def test_incident_emitted_on_main(self):
        msg = "Team&Model: antigravity:gemini-2.0-pro@google\nSigned-by: Apollo Harper"
        with patch.dict(os.environ, {"MEGINGJORD_ANTIGRAVITY_GUARD": "1"}):
            result = guard.check_commit_message(msg, branch="main")
            self.assertTrue(result.get("incident_emitted"))
            event = json.loads(guard.INCIDENTS_PATH.read_text().strip())
            self.assertEqual(event["pattern_id"], "antigravity-commit-on-main")
            self.assertEqual(event["severity"], "low")
            self.assertEqual(event["tier"], "advisory")

    def test_no_incident_on_non_main_branch(self):
        msg = "Team&Model: antigravity:gemini-2.0-pro@google\nSigned-by: Apollo Harper"
        with patch.dict(os.environ, {"MEGINGJORD_ANTIGRAVITY_GUARD": "1"}):
            result = guard.check_commit_message(msg, branch="feat/123-foo")
            self.assertFalse(result.get("incident_emitted"))
            self.assertFalse(guard.INCIDENTS_PATH.exists())

    def test_no_incident_when_non_antigravity(self):
        msg = "Team&Model: claude-code:opus-4-7@local\nSigned-by: Orla Harper"
        with patch.dict(os.environ, {"MEGINGJORD_ANTIGRAVITY_GUARD": "1"}):
            result = guard.check_commit_message(msg, branch="main")
            self.assertFalse(result["advisory"])
            self.assertFalse(guard.INCIDENTS_PATH.exists())

    def test_emit_incident_handles_oserror_gracefully(self):
        """G6: incident emit failure must not break the guard."""
        with patch.dict(os.environ, {"MEGINGJORD_ANTIGRAVITY_GUARD": "1"}):
            with patch.object(Path, "mkdir", side_effect=OSError("simulated")):
                result = guard.emit_incident("test", {"foo": "bar"})
                self.assertFalse(result)


if __name__ == "__main__":
    unittest.main()
