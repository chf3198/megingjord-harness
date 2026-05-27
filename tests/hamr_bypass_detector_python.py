"""Refs #2235 - Python detector tests; mirrors JS spec coverage."""

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "hooks" / "scripts"))
from hamr_bypass_detector import detect_bypass, emit_incident


class TestDetectBypass(unittest.TestCase):
    def test_anthropic_curl_paid_bypass(self):
        r = detect_bypass('curl -X POST https://api.anthropic.com/v1/messages')
        self.assertTrue(r["detected"])
        self.assertEqual(r["severity"], "paid-bypass")

    def test_fleet_curl_fleet_bypass(self):
        r = detect_bypass('curl -X POST http://100.91.113.16:11434/api/generate')
        self.assertTrue(r["detected"])
        self.assertEqual(r["severity"], "fleet-bypass")

    def test_localhost_ollama_fleet_bypass(self):
        r = detect_bypass('curl http://localhost:11434/api/tags')
        self.assertTrue(r["detected"])
        self.assertEqual(r["severity"], "fleet-bypass")

    def test_override_marker_suppresses(self):
        r = detect_bypass('curl http://100.91.113.16:11434/api/tags # hamr-bypass-ok: health-probe')
        self.assertTrue(r["detected"])
        self.assertTrue(r["suppressed"])
        self.assertEqual(r["override_reason"], "health-probe")

    def test_non_curl_not_detected(self):
        r = detect_bypass('node scripts/global/hamr-provider-wrapper.js')
        self.assertFalse(r["detected"])

    def test_unknown_url_not_detected(self):
        r = detect_bypass('curl https://example.com/data.json')
        self.assertFalse(r["detected"])

    def test_empty_input(self):
        self.assertFalse(detect_bypass("")["detected"])
        self.assertFalse(detect_bypass(None)["detected"])

    def test_multi_provider(self):
        r = detect_bypass('curl https://api.anthropic.com; curl https://api.openai.com')
        self.assertTrue(r["detected"])
        self.assertGreaterEqual(len(r["providers"]), 2)


class TestEmitIncident(unittest.TestCase):
    def test_writes_jsonl(self):
        with tempfile.TemporaryDirectory() as td:
            path = os.path.join(td, "incidents.jsonl")
            detection = detect_bypass('curl https://api.anthropic.com/v1/messages')
            evt = emit_incident(detection, incidents_path=path)
            self.assertIsNotNone(evt)
            with open(path) as fh:
                parsed = json.loads(fh.read().strip())
            self.assertEqual(parsed["event"], "hamr-bypass-detected")
            self.assertEqual(parsed["severity"], "paid-bypass")

    def test_suppressed_returns_none(self):
        detection = detect_bypass('curl http://localhost:11434 # hamr-bypass-ok: testing')
        self.assertIsNone(emit_incident(detection, incidents_path="/tmp/should-not-write.jsonl"))


if __name__ == "__main__":
    unittest.main()
