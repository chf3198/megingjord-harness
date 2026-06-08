"""Unit tests for the #2739 raw-fleet-curl bypass intercept in pretool_guard.

A raw curl to a fleet/ollama endpoint outside the dispatch wrappers is flagged
(#2192 vector 2) unless it carries the documented `hamr-bypass-ok` carve-out.
Fail-open: any internal error returns False (never brick a session).
"""
import os
import sys
import unittest

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


if __name__ == "__main__":
    unittest.main()
