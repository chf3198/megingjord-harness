"""Tests for #2458: HAMR merge-claim Python client."""
from __future__ import annotations

import io
import json
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock

SCRIPTS = Path(__file__).resolve().parents[2] / "hooks" / "scripts"
sys.path.insert(0, str(SCRIPTS))

import merge_claim_client as mcc  # noqa: E402


class TestFeatureFlag(unittest.TestCase):
    def test_disabled_by_default(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("MEGINGJORD_MERGE_CLAIM", None)
            self.assertFalse(mcc.feature_enabled())

    def test_enabled_when_set(self):
        with patch.dict(os.environ, {"MEGINGJORD_MERGE_CLAIM": "1"}):
            self.assertTrue(mcc.feature_enabled())


class TestSentinelBehavior(unittest.TestCase):
    """When feature off, return sentinel so admin flow not blocked (G6)."""

    def test_acquire_returns_sentinel_when_disabled(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("MEGINGJORD_MERGE_CLAIM", None)
            result = mcc.acquire(2458)
            self.assertEqual(result["claim_id"], "feature-off")

    def test_release_noop_on_sentinel(self):
        with patch.dict(os.environ, {"MEGINGJORD_MERGE_CLAIM": "1"}):
            result = mcc.release("feature-off")
            self.assertTrue(result["released"])
            self.assertTrue(result["noop"])

    def test_status_returns_feature_off_when_disabled(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("MEGINGJORD_MERGE_CLAIM", None)
            result = mcc.status(2458)
            self.assertFalse(result["held"])
            self.assertTrue(result["feature_off"])


def _mock_urlopen(payload: dict):
    """Helper: build a urlopen mock that yields a given payload."""
    m = MagicMock()
    m.__enter__ = MagicMock(return_value=MagicMock(read=lambda: json.dumps(payload).encode()))
    m.__exit__ = MagicMock(return_value=False)
    return m


class TestAcquireRelease(unittest.TestCase):
    @patch("urllib.request.urlopen")
    def test_acquire_posts_to_correct_url(self, mock_urlopen):
        mock_urlopen.return_value = _mock_urlopen({"claim_id": "abc", "ttl_s": 60})
        with patch.dict(os.environ, {"MEGINGJORD_MERGE_CLAIM": "1"}):
            result = mcc.acquire(2458, team="claude-code")
            self.assertEqual(result["claim_id"], "abc")
            req = mock_urlopen.call_args[0][0]
            self.assertIn("/merge-claim/acquire/2458", req.full_url)
            self.assertEqual(req.headers["X-hamr-team"], "claude-code")

    @patch("urllib.request.urlopen")
    def test_release_posts_to_claim_id(self, mock_urlopen):
        mock_urlopen.return_value = _mock_urlopen({"released": True, "ticket": "2458"})
        with patch.dict(os.environ, {"MEGINGJORD_MERGE_CLAIM": "1"}):
            result = mcc.release("abc-123", team="claude-code")
            self.assertTrue(result["released"])
            req = mock_urlopen.call_args[0][0]
            self.assertIn("/merge-claim/release/abc-123", req.full_url)


class TestG6Resilience(unittest.TestCase):
    @patch("urllib.request.urlopen", side_effect=OSError("network down"))
    def test_acquire_returns_none_on_network_failure(self, _):
        with patch.dict(os.environ, {"MEGINGJORD_MERGE_CLAIM": "1"}):
            result = mcc.acquire(2458)
            self.assertIsNone(result)

    @patch("urllib.request.urlopen", side_effect=OSError("network down"))
    def test_status_returns_none_on_network_failure(self, _):
        with patch.dict(os.environ, {"MEGINGJORD_MERGE_CLAIM": "1"}):
            result = mcc.status(2458)
            self.assertIsNone(result)


if __name__ == "__main__":
    unittest.main()
