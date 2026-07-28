"""Unit tests for the #2739 raw-fleet-curl bypass intercept in pretool_guard.

A raw curl to a fleet/ollama endpoint outside the dispatch wrappers is flagged
(#2192 vector 2) unless it carries the documented `hamr-bypass-ok` carve-out.
Fail-open: any internal error returns False (never brick a session).
Tests for _emit_fleet_bypass_incident added in #2782.
"""
import json
import os
import sys
import tempfile
import unittest
from unittest import mock

HOOKS = os.path.join(os.path.dirname(__file__), "..", "..", "hooks", "scripts")
sys.path.insert(0, os.path.abspath(HOOKS))

import pretool_guard  # noqa: E402


class FleetCurlIntercept(unittest.TestCase):
    def test_raw_ollama_generate_curl_is_flagged(self):
        self.assertTrue(pretool_guard.is_raw_fleet_curl(
            "curl -s http://100.91.113.16:11434/api/generate -d @req.json"))

    def test_raw_ollama_tags_curl_is_flagged(self):
        self.assertTrue(pretool_guard.is_raw_fleet_curl("curl http://host:11434/api/tags"))

    def test_carve_out_marker_suppresses_the_flag(self):
        self.assertFalse(pretool_guard.is_raw_fleet_curl(
            "curl http://host:11434/api/generate  # hamr-bypass-ok: diagnostic probe"))

    def test_non_fleet_curl_is_not_flagged(self):
        self.assertFalse(pretool_guard.is_raw_fleet_curl("curl https://api.github.com/repos/x/y"))

    def test_non_curl_command_is_not_flagged(self):
        self.assertFalse(pretool_guard.is_raw_fleet_curl("node scripts/global/fleet-red-team-dispatch.js"))

    def test_fail_open_on_bad_input(self):
        # a non-string must not raise (fail-open)
        self.assertFalse(pretool_guard.is_raw_fleet_curl(None))


class FleetCurlGoldenPathRedirect(unittest.TestCase):
    """Epic #3807 C2 (#3810): the redirect is now affordance-first — it names the
    `npm run fleet` golden-path default so the right move is a copy-paste (poka-yoke).
    These assert the affordance is present AND that no control was loosened."""

    def test_redirect_names_golden_path_default(self):
        # AC2: the affordance — the exact copy-pasteable golden-path command is named.
        self.assertIn("npm run fleet", pretool_guard.FLEET_CURL_REDIRECT_MSG)

    def test_redirect_preserves_diagnostic_carve_out(self):
        # Control preserved: the audited-diagnostic carve-out is still advertised.
        self.assertIn("hamr-bypass-ok", pretool_guard.FLEET_CURL_REDIRECT_MSG)

    def test_redirect_remains_self_resolvable_no_client_prompt(self):
        # Operator-identity contract preserved: still operator-resolvable, not a client prompt.
        self.assertIn("no client prompt", pretool_guard.FLEET_CURL_REDIRECT_MSG.lower())

    def test_detection_control_unchanged_still_flags_raw_fleet_curl(self):
        # Control preserved: the DENY predicate still fires on a raw fleet curl (affordance
        # lowers friction of the right move; it does NOT weaken the gate).
        self.assertTrue(pretool_guard.is_raw_fleet_curl(
            "curl http://100.91.113.16:11434/api/generate -d @req.json"))


class EmitFleetBypassIncident(unittest.TestCase):
    """Verify _emit_fleet_bypass_incident writes correct JSONL (#2782 AC2-AC4)."""

    def _incidents_path(self, tmp_home: str) -> str:
        return os.path.join(tmp_home, ".megingjord", "incidents.jsonl")

    def test_writes_one_line_with_required_fields(self):
        """AC2: single call writes exactly one JSONL line with required fields."""
        with tempfile.TemporaryDirectory() as tmp_home:
            with mock.patch.dict(os.environ, {"HOME": tmp_home}):
                pretool_guard._emit_fleet_bypass_incident("/some/cwd")
            path = self._incidents_path(tmp_home)
            self.assertTrue(os.path.exists(path))
            with open(path) as fhandle:
                lines = fhandle.readlines()
            self.assertEqual(len(lines), 1)
            event = json.loads(lines[0])
            self.assertEqual(event["version"], 3)
            self.assertEqual(event["event"], "governance.raw-fleet-curl-bypass")
            self.assertEqual(event["pattern_id"], "raw-fleet-curl-bypasses-hamr")
            self.assertEqual(event["service"], "pretool-guard-fleet-bypass")

    def test_two_calls_append_two_lines(self):
        """AC3: second call appends; does not overwrite."""
        with tempfile.TemporaryDirectory() as tmp_home:
            with mock.patch.dict(os.environ, {"HOME": tmp_home}):
                pretool_guard._emit_fleet_bypass_incident("/cwd")
                pretool_guard._emit_fleet_bypass_incident("/cwd")
            path = self._incidents_path(tmp_home)
            with open(path) as fhandle:
                lines = fhandle.readlines()
            self.assertEqual(len(lines), 2)

    def test_creates_parent_directory(self):
        """AC3 (mkdir): emit creates .megingjord/ if absent."""
        with tempfile.TemporaryDirectory() as tmp_home:
            with mock.patch.dict(os.environ, {"HOME": tmp_home}):
                pretool_guard._emit_fleet_bypass_incident("/cwd")
            self.assertTrue(os.path.isdir(os.path.join(tmp_home, ".megingjord")))


if __name__ == "__main__":
    unittest.main()
