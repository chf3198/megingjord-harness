"""Unit coverage for hooks/scripts/friction_event.py (#3165)."""
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "hooks" / "scripts"))
import friction_event as fe  # noqa: E402


class BuildFrictionEvent(unittest.TestCase):
    def test_shape_matches_js(self):
        ev = fe.build_friction_event(
            "worktree-push-gate-commit-desync",
            {"team": "claude-code", "runtime": "claude-code", "role": "admin",
             "surface": "pretool_guard.py", "severity": "medium"},
            now="2026-06-21T00:00:00Z")
        self.assertEqual(ev["event"], fe.FRICTION_EVENT)
        self.assertEqual(ev["tier"], 1)
        self.assertEqual(ev["version"], 3)
        self.assertEqual(ev["pattern_id"], "worktree-push-gate-commit-desync")
        self.assertEqual(ev["severity"], "medium")
        self.assertTrue(fe.is_valid_friction(ev))

    def test_unknown_severity_defaults_low(self):
        ev = fe.build_friction_event("p", {"severity": "bogus"})
        self.assertEqual(ev["severity"], "low")


class IsValidFriction(unittest.TestCase):
    def test_rejects_bad_events(self):
        self.assertFalse(fe.is_valid_friction({"event": "other", "tier": 1,
                                               "pattern_id": "x", "severity": "low"}))
        self.assertFalse(fe.is_valid_friction({"event": fe.FRICTION_EVENT, "tier": 2,
                                               "pattern_id": "x", "severity": "low"}))
        self.assertFalse(fe.is_valid_friction({"event": fe.FRICTION_EVENT, "tier": 1,
                                               "severity": "low"}))


class EmitFriction(unittest.TestCase):
    def test_appends_and_redacts(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "incidents.jsonl"
            ev = fe.emit_friction(
                "fleet-32b-timeout",
                {"team": "cursor", "severity": "medium",
                 "detail": "token sk-ant-0123456789012345678901234567890123 leaked"},
                path=path)
            self.assertIsNotNone(ev)
            self.assertNotIn("sk-ant-0123456789", ev["detail"])
            lines = path.read_text(encoding="utf-8").strip().split("\n")
            self.assertEqual(len(lines), 1)
            parsed = json.loads(lines[0])
            self.assertEqual(parsed["pattern_id"], "fleet-32b-timeout")
            self.assertEqual(parsed["tier"], 1)

    def test_emit_never_raises_on_bad_path(self):
        # A directory that cannot be created should degrade to None, not raise.
        result = fe.emit_friction("p", {"severity": "low"}, path=Path("/proc/forbidden/x.jsonl"))
        self.assertIsNone(result)


if __name__ == "__main__":
    unittest.main()
