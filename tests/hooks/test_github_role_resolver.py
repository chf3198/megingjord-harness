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
