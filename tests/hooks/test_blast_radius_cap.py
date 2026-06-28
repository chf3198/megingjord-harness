"""Tests for #2917 session blast-radius cap controls."""
import io
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

REPO_ROOT = Path(__file__).resolve().parents[2]
HOOKS = REPO_ROOT / "hooks" / "scripts"
sys.path.insert(0, str(HOOKS))

import blast_radius_cap as br  # noqa: E402
import pretool_guard  # noqa: E402


class BlastRadiusCapTests(unittest.TestCase):
    def test_check_caps_detects_file_breach(self):
        reason = br.check_caps({"files_edited_count": 1001}, br.DEFAULT_CAPS)
        self.assertIn("files_edited_count=1001", reason)

    def test_check_caps_detects_push_breach(self):
        reason = br.check_caps({"push_count": 51}, br.DEFAULT_CAPS)
        self.assertIn("push_count=51", reason)

    def test_check_caps_detects_cost_breach(self):
        reason = br.check_caps({"provider_call_count": 401}, br.DEFAULT_CAPS)
        self.assertIn("estimated_cost_usd=20.05", reason)

    def test_load_caps_reads_yaml_block(self):
        with tempfile.TemporaryDirectory() as tmp:
            cfg = Path(tmp) / "config"
            cfg.mkdir(parents=True)
            (cfg / "governance-rules.yaml").write_text(
                "blast_radius_caps:\n  max_files_per_session: 3\n"
                "  max_pushes_per_session: 4\n  max_cost_usd_per_session: 0.50\n",
                encoding="utf-8",
            )
            caps = br.load_caps(tmp)
        self.assertEqual(caps["max_files_per_session"], 3.0)
        self.assertEqual(caps["max_pushes_per_session"], 4.0)
        self.assertEqual(caps["max_cost_usd_per_session"], 0.5)

    def test_emit_cap_incident_writes_event(self):
        with tempfile.TemporaryDirectory() as home:
            with patch("pathlib.Path.home", return_value=Path(home)):
                br.emit_cap_incident("test-reason", cwd="/tmp/demo", override=True)
            log = Path(home) / ".megingjord" / "incidents.jsonl"
            payload = json.loads(log.read_text(encoding="utf-8").strip())
        self.assertEqual(payload["event"], "SESSION_BLAST_RADIUS_CAP")
        self.assertTrue(payload["override"])


class PretoolGuardIntegrationTests(unittest.TestCase):
    def test_pretool_guard_denies_when_cap_exceeded(self):
        payload = {"tool_name": "run_in_terminal", "tool_input": {"command": "echo hi"}, "cwd": str(REPO_ROOT)}
        state = {"flags": {}, "admin_ops": {}, "blast_radius": {"files_edited_count": 1001}, "active_ticket": 2917}
        captured = {}

        def fake_emit(decision, reason, extra=None):
            captured["decision"], captured["reason"] = decision, reason
            return 0

        with patch("pretool_guard.ensure_state", return_value=state), \
             patch("state_store.reset_on_branch_change", return_value=state), \
             patch("pretool_guard.emit", side_effect=fake_emit), \
             patch("sys.stdin", io.StringIO(json.dumps(payload))):
            pretool_guard.main()
        self.assertEqual(captured.get("decision"), "deny")
        self.assertIn("Session blast-radius cap exceeded", captured.get("reason", ""))

    def test_pretool_guard_allows_with_override_env(self):
        payload = {"tool_name": "run_in_terminal", "tool_input": {"command": "echo hi"}, "cwd": str(REPO_ROOT)}
        state = {"flags": {}, "admin_ops": {}, "blast_radius": {"files_edited_count": 1001}, "active_ticket": 2917}
        with patch("pretool_guard.ensure_state", return_value=state), \
             patch("state_store.reset_on_branch_change", return_value=state), \
             patch.dict(os.environ, {br.ENV_BYPASS: "1"}, clear=False), \
             patch("sys.stdin", io.StringIO(json.dumps(payload))):
            code = pretool_guard.main()
        self.assertEqual(code, 0)


if __name__ == "__main__":
    unittest.main()
