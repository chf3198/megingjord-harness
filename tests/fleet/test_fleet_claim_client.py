"""Tests for #2525: HAMR /fleet endpoints client."""
from __future__ import annotations
import os, sys, unittest
from pathlib import Path
from unittest.mock import patch, MagicMock

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts" / "global"))
import importlib.util
spec = importlib.util.spec_from_file_location("fcc", str(Path(__file__).resolve().parents[2] / "scripts" / "global" / "fleet-claim-client.py"))
fcc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fcc)


class TestFleetClaim(unittest.TestCase):
    def test_feature_off_by_default(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("MEGINGJORD_FLEET_CLAIM", None)
            self.assertFalse(fcc.feature_enabled())

    def test_acquire_returns_sentinel_when_off(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("MEGINGJORD_FLEET_CLAIM", None)
            result = fcc.acquire("100.91.113.16", "qwen2.5-coder:32b", ticket=2519)
            self.assertEqual(result["claim_id"], "fleet-claim-feature-off")

    def test_release_noop_on_sentinel(self):
        with patch.dict(os.environ, {"MEGINGJORD_FLEET_CLAIM": "1"}):
            result = fcc.release("fleet-claim-feature-off")
            self.assertTrue(result["released"])
            self.assertTrue(result["noop"])

    def test_in_flight_off_returns_feature_off(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("MEGINGJORD_FLEET_CLAIM", None)
            result = fcc.in_flight()
            self.assertTrue(result["feature_off"])
            self.assertEqual(result["entries"], [])

    def test_acquire_returns_none_on_network_failure(self):
        with patch.dict(os.environ, {"MEGINGJORD_FLEET_CLAIM": "1"}):
            with patch("urllib.request.urlopen", side_effect=OSError("network")):
                result = fcc.acquire("h", "m")
                self.assertIsNone(result)

    def test_github_label_acquire_failure_returns_none(self):
        with patch("subprocess.run", side_effect=FileNotFoundError("gh")):
            self.assertIsNone(fcc.github_label_acquire("o/r", 1, "h", "m"))


if __name__ == "__main__":
    unittest.main()
