"""Tests for #2456: derive_roles_from_github resolver + 60s TTL cache.

Move 1 of Epic #2451 — GitHub-as-event-source for baton state.
"""
from __future__ import annotations

import os
import sys
import time
import unittest
from pathlib import Path
from unittest.mock import patch

SCRIPTS = Path(__file__).resolve().parents[2] / "hooks" / "scripts"
sys.path.insert(0, str(SCRIPTS))

import github_role_resolver as resolver  # noqa: E402
from stop_checks import ticket_from_branch, effective_roles  # noqa: E402


class TestFeatureFlag(unittest.TestCase):
    def setUp(self):
        resolver.clear_cache()

    def test_disabled_by_default(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("MEGINGJORD_DERIVE_ROLES_FROM_GH", None)
            self.assertFalse(resolver.feature_enabled())

    def test_enabled_when_set(self):
        with patch.dict(os.environ, {"MEGINGJORD_DERIVE_ROLES_FROM_GH": "1"}):
            self.assertTrue(resolver.feature_enabled())

    def test_returns_none_when_disabled(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("MEGINGJORD_DERIVE_ROLES_FROM_GH", None)
            self.assertIsNone(resolver.derive_roles_from_github(2456))


class TestRoleParsing(unittest.TestCase):
    def test_parse_empty_labels(self):
        result = resolver._parse_roles({"labels": []})
        self.assertEqual(result, {"manager": False, "collaborator": False,
                                  "admin": False, "consultant": False})

    def test_parse_single_role(self):
        result = resolver._parse_roles({"labels": [{"name": "role:collaborator"}]})
        self.assertTrue(result["collaborator"])
        self.assertFalse(result["admin"])

    def test_parse_admin_role(self):
        result = resolver._parse_roles({"labels": [{"name": "role:admin"},
                                                     {"name": "status:testing"}]})
        self.assertTrue(result["admin"])
        self.assertFalse(result["manager"])


class TestTtlCache(unittest.TestCase):
    def setUp(self):
        resolver.clear_cache()

    def test_cache_hit_within_ttl(self):
        with patch.dict(os.environ, {"MEGINGJORD_DERIVE_ROLES_FROM_GH": "1"}):
            with patch.object(resolver, "_gh_view") as mock_gh:
                mock_gh.return_value = {"labels": [{"name": "role:admin"}]}
                resolver.derive_roles_from_github(2456)
                resolver.derive_roles_from_github(2456)
                self.assertEqual(mock_gh.call_count, 1)  # second call cached

    def test_cache_miss_after_ttl(self):
        with patch.dict(os.environ, {"MEGINGJORD_DERIVE_ROLES_FROM_GH": "1"}):
            with patch.object(resolver, "_gh_view") as mock_gh:
                mock_gh.return_value = {"labels": []}
                resolver.derive_roles_from_github(2456)
                # Manually expire cache
                old_ttl = resolver.CACHE_TTL_SECONDS
                resolver.CACHE_TTL_SECONDS = 0
                try:
                    resolver.derive_roles_from_github(2456)
                    self.assertEqual(mock_gh.call_count, 2)
                finally:
                    resolver.CACHE_TTL_SECONDS = old_ttl

    def test_offline_returns_stale_cache_g6(self):
        with patch.dict(os.environ, {"MEGINGJORD_DERIVE_ROLES_FROM_GH": "1"}):
            with patch.object(resolver, "_gh_view") as mock_gh:
                mock_gh.return_value = {"labels": [{"name": "role:admin"}]}
                first = resolver.derive_roles_from_github(2456)
                # Simulate GitHub down on next call
                resolver.CACHE_TTL_SECONDS = 0
                mock_gh.return_value = None
                second = resolver.derive_roles_from_github(2456)
                self.assertEqual(first, second, "G6: should return stale cache on offline")
                resolver.CACHE_TTL_SECONDS = 60

    def test_offline_no_cache_returns_none(self):
        resolver.clear_cache()
        with patch.dict(os.environ, {"MEGINGJORD_DERIVE_ROLES_FROM_GH": "1"}):
            with patch.object(resolver, "_gh_view", return_value=None):
                self.assertIsNone(resolver.derive_roles_from_github(2456))


class TestTicketExtraction(unittest.TestCase):
    def test_fix_branch(self):
        self.assertEqual(ticket_from_branch("fix/2456-derive-roles"), 2456)

    def test_feat_branch(self):
        self.assertEqual(ticket_from_branch("feat/1234-foo"), 1234)

    def test_main_branch(self):
        self.assertIsNone(ticket_from_branch("main"))

    def test_none_branch(self):
        self.assertIsNone(ticket_from_branch(None))

    def test_unticketed_branch(self):
        self.assertIsNone(ticket_from_branch("feat/no-ticket-here"))


class TestEffectiveRoles(unittest.TestCase):
    def setUp(self):
        resolver.clear_cache()

    def test_passthrough_when_feature_off(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("MEGINGJORD_DERIVE_ROLES_FROM_GH", None)
            state_roles = {"manager": True, "collaborator": True, "admin": False, "consultant": False}
            result = effective_roles(state_roles, "fix/2456-foo")
            self.assertEqual(result, state_roles)

    def test_derives_when_feature_on(self):
        with patch.dict(os.environ, {"MEGINGJORD_DERIVE_ROLES_FROM_GH": "1"}):
            with patch.object(resolver, "_gh_view") as mock_gh:
                mock_gh.return_value = {"labels": [{"name": "role:admin"}]}
                result = effective_roles({"collaborator": True}, "fix/2456-foo")
                self.assertTrue(result["admin"])

    def test_falls_back_when_branch_has_no_ticket(self):
        with patch.dict(os.environ, {"MEGINGJORD_DERIVE_ROLES_FROM_GH": "1"}):
            state_roles = {"collaborator": True}
            result = effective_roles(state_roles, "main")
            self.assertEqual(result, state_roles)


if __name__ == "__main__":
    unittest.main()


class TestMaxStaleBound(unittest.TestCase):
    """Per qwen-7b review of c49dbc5: stale cache must have upper bound."""

    def setUp(self):
        resolver.clear_cache()

    def test_stale_within_max_returns_cache(self):
        with patch.dict(os.environ, {"MEGINGJORD_DERIVE_ROLES_FROM_GH": "1"}):
            with patch.object(resolver, "_gh_view") as mock_gh:
                mock_gh.return_value = {"labels": [{"name": "role:admin"}]}
                resolver.derive_roles_from_github(2456)
                # Force cache age within stale-bound but past TTL
                resolver.CACHE_TTL_SECONDS = 0
                mock_gh.return_value = None
                result = resolver.derive_roles_from_github(2456)
                self.assertIsNotNone(result)
                resolver.CACHE_TTL_SECONDS = 60

    def test_stale_beyond_max_returns_none(self):
        with patch.dict(os.environ, {"MEGINGJORD_DERIVE_ROLES_FROM_GH": "1"}):
            with patch.object(resolver, "_gh_view") as mock_gh:
                mock_gh.return_value = {"labels": [{"name": "role:admin"}]}
                resolver.derive_roles_from_github(2456)
                # Force cache age past MAX_STALE
                resolver.CACHE_TTL_SECONDS = 0
                resolver.MAX_STALE_SECONDS = 0
                mock_gh.return_value = None
                result = resolver.derive_roles_from_github(2456)
                self.assertIsNone(result, "G6 bound: should not serve cache beyond MAX_STALE")
                resolver.CACHE_TTL_SECONDS = 60
                resolver.MAX_STALE_SECONDS = 300


class TestChaosOffline(unittest.TestCase):
    """#2460: chaos paths for offline behavior."""

    def setUp(self):
        resolver.clear_cache()

    def test_chaos_gh_cli_not_found_no_cache(self):
        """gh CLI absent (FileNotFoundError) returns None when no cache."""
        with patch.dict(os.environ, {"MEGINGJORD_DERIVE_ROLES_FROM_GH": "1",
                                       "MEGINGJORD_QUIET_RESOLVER": "1"}):
            with patch("subprocess.run", side_effect=FileNotFoundError("gh not found")):
                self.assertIsNone(resolver.derive_roles_from_github(2460))

    def test_chaos_gh_cli_not_found_with_cache(self):
        """gh CLI absent serves stale cache within max-stale (G6)."""
        with patch.dict(os.environ, {"MEGINGJORD_DERIVE_ROLES_FROM_GH": "1",
                                       "MEGINGJORD_QUIET_RESOLVER": "1"}):
            with patch.object(resolver, "_gh_view") as mock_gh:
                mock_gh.return_value = {"labels": [{"name": "role:admin"}]}
                resolver.derive_roles_from_github(2460)
                # Force expiry + simulate gh CLI absent
                resolver.CACHE_TTL_SECONDS = 0
                with patch("subprocess.run", side_effect=FileNotFoundError("gh not found")):
                    result = resolver.derive_roles_from_github(2460)
                self.assertIsNotNone(result)
                self.assertTrue(result["admin"])
                resolver.CACHE_TTL_SECONDS = 60

    def test_chaos_rate_limit_returns_none_no_cache(self):
        """Simulated rate-limit (subprocess returncode != 0) returns None."""
        with patch.dict(os.environ, {"MEGINGJORD_DERIVE_ROLES_FROM_GH": "1",
                                       "MEGINGJORD_QUIET_RESOLVER": "1"}):
            mock_result = type("R", (), {"returncode": 1, "stdout": "", "stderr": "rate limit"})
            with patch("subprocess.run", return_value=mock_result):
                self.assertIsNone(resolver.derive_roles_from_github(2460))

    def test_chaos_timeout_returns_none_no_cache(self):
        """Subprocess timeout returns None."""
        import subprocess as _sp
        with patch.dict(os.environ, {"MEGINGJORD_DERIVE_ROLES_FROM_GH": "1",
                                       "MEGINGJORD_QUIET_RESOLVER": "1"}):
            with patch("subprocess.run", side_effect=_sp.TimeoutExpired("gh", 10)):
                self.assertIsNone(resolver.derive_roles_from_github(2460))

    def test_user_visible_warning_emitted(self):
        """G8: stderr message on degraded path unless MEGINGJORD_QUIET_RESOLVER set."""
        with patch.dict(os.environ, {"MEGINGJORD_DERIVE_ROLES_FROM_GH": "1"}):
            os.environ.pop("MEGINGJORD_QUIET_RESOLVER", None)
            import io as _io
            with patch("sys.stderr", new=_io.StringIO()) as stderr:
                with patch.object(resolver, "_gh_view", return_value=None):
                    resolver.derive_roles_from_github(99999)
                self.assertIn("degraded", stderr.getvalue())
                self.assertIn("#99999", stderr.getvalue())

    def test_quiet_mode_suppresses_warning(self):
        """G3: cron/CI mode can suppress stderr noise."""
        with patch.dict(os.environ, {"MEGINGJORD_DERIVE_ROLES_FROM_GH": "1",
                                       "MEGINGJORD_QUIET_RESOLVER": "1"}):
            import io as _io
            with patch("sys.stderr", new=_io.StringIO()) as stderr:
                with patch.object(resolver, "_gh_view", return_value=None):
                    resolver.derive_roles_from_github(99999)
                self.assertEqual(stderr.getvalue(), "")
