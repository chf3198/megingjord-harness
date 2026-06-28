"""Tests for #2913 session behavioral anomaly detection (Gap G-15)."""
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

import session_anomaly as sa  # noqa: E402
import pretool_guard  # noqa: E402


_YAML = (
    "session_anomaly_thresholds:\n"
    "  writes_in_session: 5\n"
    "  sensitive_path_reads: 3\n"
    "  pushes_in_session: 2\n"
)


def _tmp_config(text: str) -> str:
    tmp = tempfile.mkdtemp()
    (Path(tmp) / "config").mkdir(parents=True)
    (Path(tmp) / "config" / "governance-rules.yaml").write_text(
        text, encoding="utf-8",
    )
    return tmp


class LoadThresholdsTests(unittest.TestCase):
    def test_reads_yaml_block(self):
        cwd = _tmp_config(_YAML)
        t = sa.load_thresholds(cwd)
        self.assertEqual(t["writes_in_session"], 5)
        self.assertEqual(t["sensitive_path_reads"], 3)
        self.assertEqual(t["pushes_in_session"], 2)

    def test_returns_defaults_on_missing_file(self):
        t = sa.load_thresholds("/nonexistent")
        self.assertEqual(t, sa.DEFAULT_THRESHOLDS)


class UpdateSessionCountersTests(unittest.TestCase):
    def _state(self):
        return {"blast_radius": {"push_count": 0}}

    def test_increments_total_writes_on_edit_tool(self):
        state = self._state()
        sa.update_session_counters(state, "Write", ["/some/file.py"])
        self.assertEqual(state["session"]["total_writes"], 1)

    def test_increments_sensitive_reads_on_env_path(self):
        state = self._state()
        sa.update_session_counters(state, "Read", ["/project/.env"])
        self.assertEqual(state["session"]["total_reads_sensitive_paths"], 1)

    def test_no_sensitive_read_on_normal_path(self):
        state = self._state()
        sa.update_session_counters(state, "Read", ["/project/src/main.py"])
        self.assertEqual(state["session"].get("total_reads_sensitive_paths", 0), 0)

    def test_syncs_pushes_from_blast_radius(self):
        state = {"blast_radius": {"push_count": 3}}
        sa.update_session_counters(state, "Bash", ["git push"])
        self.assertEqual(state["session"]["total_pushes"], 3)


class CheckAnomalyTests(unittest.TestCase):
    def test_detects_write_threshold_breach(self):
        cwd = _tmp_config(_YAML)
        state = {"session": {"total_writes": 6, "total_reads_sensitive_paths": 0, "total_pushes": 0}}
        reason = sa.check_anomaly(state, cwd)
        self.assertIn("total_writes=6", reason)

    def test_detects_sensitive_read_breach(self):
        cwd = _tmp_config(_YAML)
        state = {"session": {"total_writes": 0, "total_reads_sensitive_paths": 4, "total_pushes": 0}}
        reason = sa.check_anomaly(state, cwd)
        self.assertIn("total_reads_sensitive_paths=4", reason)

    def test_no_anomaly_below_thresholds(self):
        cwd = _tmp_config(_YAML)
        state = {"session": {"total_writes": 4, "total_reads_sensitive_paths": 2, "total_pushes": 1}}
        self.assertIsNone(sa.check_anomaly(state, cwd))


class EmitAnomalyIncidentTests(unittest.TestCase):
    def test_writes_anomaly_detected_event(self):
        with tempfile.TemporaryDirectory() as home:
            with patch("pathlib.Path.home", return_value=Path(home)):
                sa.INCIDENTS_PATH = Path(home) / ".megingjord" / "incidents.jsonl"
                sa.emit_anomaly_incident("total_writes=6 > writes_in_session=5", "/tmp/r")
            log = Path(home) / ".megingjord" / "incidents.jsonl"
            payload = json.loads(log.read_text(encoding="utf-8").strip())
        self.assertEqual(payload["event"], "ANOMALY_DETECTED")
        self.assertEqual(payload["gap"], "G-15")
        self.assertIn("total_writes", payload["reason"])

    def test_writes_override_fields_when_bypassed(self):
        with tempfile.TemporaryDirectory() as home:
            with patch("pathlib.Path.home", return_value=Path(home)):
                sa.INCIDENTS_PATH = Path(home) / ".megingjord" / "incidents.jsonl"
                sa.emit_anomaly_incident("total_writes=999", "/tmp/r", override=True)
            log = Path(home) / ".megingjord" / "incidents.jsonl"
            payload = json.loads(log.read_text(encoding="utf-8").strip())
        self.assertTrue(payload["override"])
        self.assertEqual(payload["override_env"], sa.ENV_ANOMALY_BYPASS)



class PretoolGuardAnomalyIntegrationTests(unittest.TestCase):
    def _make_payload(self, tool="run_in_terminal"):
        return {"tool_name": tool, "tool_input": {"command": "echo hi"}, "cwd": str(REPO_ROOT)}

    def test_denies_when_anomaly_threshold_exceeded(self):
        payload = self._make_payload()
        state = {
            "flags": {}, "admin_ops": {}, "blast_radius": {"push_count": 0},
            "session": {"total_writes": 999, "total_reads_sensitive_paths": 0, "total_pushes": 0},
            "active_ticket": 2913,
        }
        captured = {}

        def fake_emit(decision, reason, extra=None):
            captured["decision"], captured["reason"] = decision, reason
            return 1

        with patch("pretool_guard.ensure_state", return_value=state), \
             patch("state_store.reset_on_branch_change", return_value=state), \
             patch("pretool_guard.emit", side_effect=fake_emit), \
             patch("session_anomaly.emit_anomaly_incident"), \
             patch("sys.stdin", io.StringIO(json.dumps(payload))):
            pretool_guard.main()
        self.assertEqual(captured.get("decision"), "deny")
        self.assertIn("anomaly detected", captured.get("reason", "").lower())

    def test_allows_with_anomaly_override_env(self):
        payload = self._make_payload()
        state = {
            "flags": {}, "admin_ops": {}, "blast_radius": {"push_count": 0},
            "session": {"total_writes": 9999, "total_reads_sensitive_paths": 0, "total_pushes": 0},
            "active_ticket": 3316,
        }
        with patch("pretool_guard.ensure_state", return_value=state), \
             patch("state_store.reset_on_branch_change", return_value=state), \
             patch.dict(os.environ, {sa.ENV_ANOMALY_BYPASS: "1"}, clear=False), \
             patch("session_anomaly.emit_anomaly_incident"), \
             patch("sys.stdin", io.StringIO(json.dumps(payload))):
            code = pretool_guard.main()
        self.assertEqual(code, 0)


if __name__ == "__main__":
    unittest.main()
