"""Tests for #2457/#2918: append-only baton-events.jsonl emitter (schema v3)."""
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

import baton_event_emitter as emitter  # noqa: E402


class TestFeatureFlag(unittest.TestCase):
    def test_enabled_by_default(self):
        """#2918: feature is ON by default; no env var needed."""
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("MEGINGJORD_BATON_EVENT_LOG", None)
            self.assertTrue(emitter.feature_enabled())

    def test_disabled_when_set_to_zero(self):
        """#2918: opt-out via MEGINGJORD_BATON_EVENT_LOG=0."""
        with patch.dict(os.environ, {"MEGINGJORD_BATON_EVENT_LOG": "0"}):
            self.assertFalse(emitter.feature_enabled())

    def test_enabled_when_set_to_one(self):
        with patch.dict(os.environ, {"MEGINGJORD_BATON_EVENT_LOG": "1"}):
            self.assertTrue(emitter.feature_enabled())


class TestRedaction(unittest.TestCase):
    def test_redact_anthropic_key(self):
        result = emitter.redact("token sk-ant-abc123def456ghi789jkl000")
        self.assertIn("[REDACTED:anthropic-key]", result)

    def test_redact_github_pat(self):
        result = emitter.redact("ghp_AAABBBCCCDDDEEEFFFGGGHHHIIIJJJ")
        self.assertIn("[REDACTED:github-pat]", result)

    def test_redact_email(self):
        result = emitter.redact("contact me at alice@example.com today")
        self.assertIn("[REDACTED:email]", result)

    def test_no_redaction_on_clean_text(self):
        result = emitter.redact("plain governance text")
        self.assertEqual(result, "plain governance text")


class TestEmit(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.log_path = Path(self.tmp.name) / "baton-events.jsonl"
        self.orig_path = emitter.EVENT_LOG_PATH
        emitter.EVENT_LOG_PATH = self.log_path

    def tearDown(self):
        emitter.EVENT_LOG_PATH = self.orig_path
        self.tmp.cleanup()

    def test_emit_when_disabled_returns_false(self):
        with patch.dict(os.environ, {"MEGINGJORD_BATON_EVENT_LOG": "0"}):
            self.assertFalse(emitter.emit_baton_event("test", ticket=2457))
            self.assertFalse(self.log_path.exists())

    def test_emit_when_enabled_writes_jsonl(self):
        with patch.dict(os.environ, {"MEGINGJORD_BATON_EVENT_LOG": "1"}):
            ok = emitter.emit_baton_event("role-handoff", ticket=2457,
                                            from_role="collaborator", to_role="admin")
            self.assertTrue(ok)
            self.assertTrue(self.log_path.exists())
            event = json.loads(self.log_path.read_text().strip())
            self.assertEqual(event["version"], 3)
            self.assertEqual(event["service"], "baton")
            self.assertEqual(event["event"], "role-handoff")
            self.assertEqual(event["ticket"], 2457)
            self.assertEqual(event["from"], "collaborator")
            self.assertEqual(event["to"], "admin")
            self.assertIn("ts", event)
            self.assertIn("env", event)

    def test_emit_redacts_summary(self):
        with patch.dict(os.environ, {"MEGINGJORD_BATON_EVENT_LOG": "1"}):
            emitter.emit_baton_event("test", ticket=1, summary="token sk-ant-xxxxxxxxxxxxxxxxxxxx")
            event = json.loads(self.log_path.read_text().strip())
            self.assertIn("[REDACTED:anthropic-key]", event["_summary"])

    def test_emit_append_only(self):
        with patch.dict(os.environ, {"MEGINGJORD_BATON_EVENT_LOG": "1"}):
            emitter.emit_baton_event("a", ticket=1)
            emitter.emit_baton_event("b", ticket=2)
            lines = self.log_path.read_text().strip().split("\n")
            self.assertEqual(len(lines), 2)
            self.assertEqual(json.loads(lines[0])["event"], "a")
            self.assertEqual(json.loads(lines[1])["event"], "b")

    def test_emit_role_handoff_wrapper(self):
        with patch.dict(os.environ, {"MEGINGJORD_BATON_EVENT_LOG": "1"}):
            self.assertTrue(emitter.emit_role_handoff("collaborator", "admin", 2457))
            event = json.loads(self.log_path.read_text().strip())
            self.assertEqual(event["from"], "collaborator")
            self.assertEqual(event["to"], "admin")
            self.assertIn("collaborator -> admin", event["_summary"])

    def test_emit_handles_io_error_gracefully(self):
        """G6: emitter MUST NOT break the baton on log-write failure."""
        with patch.dict(os.environ, {"MEGINGJORD_BATON_EVENT_LOG": "1"}):
            emitter.EVENT_LOG_PATH = Path("/nonexistent-dir-12345/baton-events.jsonl")
            with patch.object(Path, "mkdir", side_effect=OSError("simulated")):
                result = emitter.emit_baton_event("test", ticket=1)
                self.assertFalse(result)


if __name__ == "__main__":
    unittest.main()
