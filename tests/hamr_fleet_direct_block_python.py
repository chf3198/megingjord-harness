"""Refs #2236 - Python fleet-direct-block tests."""

import os
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "hooks" / "scripts"))
from hamr_fleet_direct_block import should_block, is_enabled, block_message, ENV_FLAG, REDIRECT_MSG


class TestIsEnabled(unittest.TestCase):
    def test_env_1(self):
        self.assertTrue(is_enabled({ENV_FLAG: "1"}))

    def test_env_0(self):
        self.assertFalse(is_enabled({ENV_FLAG: "0"}))

    def test_missing(self):
        self.assertFalse(is_enabled({}))


class TestShouldBlock(unittest.TestCase):
    def test_env_off_fleet_bypass_no_block(self):
        r = should_block({"detected": True, "severity": "fleet-bypass"}, env={})
        self.assertFalse(r["block"])
        self.assertEqual(r["reason"], "env-flag-off")

    def test_env_on_fleet_bypass_BLOCKS(self):
        r = should_block({"detected": True, "severity": "fleet-bypass"}, env={ENV_FLAG: "1"})
        self.assertTrue(r["block"])
        self.assertIn("fleet-red-team-dispatch", r["message"])

    def test_env_on_paid_bypass_NOT_block_out_of_scope(self):
        r = should_block({"detected": True, "severity": "paid-bypass"}, env={ENV_FLAG: "1"})
        self.assertFalse(r["block"])
        self.assertEqual(r["reason"], "paid-bypass-not-fleet-scope")

    def test_env_on_suppressed_no_block(self):
        r = should_block({"detected": True, "suppressed": True}, env={ENV_FLAG: "1"})
        self.assertFalse(r["block"])
        self.assertEqual(r["reason"], "override-marker-suppresses")

    def test_no_detection_no_block(self):
        r = should_block({"detected": False}, env={ENV_FLAG: "1"})
        self.assertFalse(r["block"])


class TestBlockMessage(unittest.TestCase):
    def test_includes_providers(self):
        msg = block_message({"providers": [{"name": "ollama-fleet"}, {"name": "ollama-local-ip"}]})
        self.assertIn("ollama-fleet, ollama-local-ip", msg)

    def test_no_providers(self):
        msg = block_message({})
        self.assertIn("unknown", msg)


class TestEnvConstants(unittest.TestCase):
    def test_env_flag_name(self):
        self.assertEqual(ENV_FLAG, "MEGINGJORD_FLEET_DIRECT_BLOCK")

    def test_redirect_msg_cites_dispatcher(self):
        self.assertIn("fleet-red-team-dispatch", REDIRECT_MSG)


if __name__ == "__main__":
    unittest.main()
