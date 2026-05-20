"""Tests for #2005: Stop hook false-positive warning after admin cycle complete.

Gap 1: post_merge_messages() completion guard via ops parameter.
Gap 2: detect_session_signals() code-changed gated on recent-commits.
"""
from __future__ import annotations

import subprocess
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

SCRIPTS = Path(__file__).resolve().parents[2] / "hooks" / "scripts"
sys.path.insert(0, str(SCRIPTS))

from stop_checks import post_merge_messages  # noqa: E402


class TestPostMergeCompletionGuard(unittest.TestCase):
    """Gap 1 (#2005): ops completion guard suppresses checklist after merge."""

    def test_suppresses_when_merge_complete(self):
        """No messages when ops['merge'] is True, even with code-changed signal."""
        result = post_merge_messages(
            signals=["code-changed", "recent-commits"],
            has_messages=False,
            ops={"merge": True},
        )
        self.assertEqual(result, [])

    def test_fires_when_merge_not_complete(self):
        """Checklist fires when code-changed present and merge not done."""
        result = post_merge_messages(
            signals=["code-changed"],
            has_messages=False,
            ops={"merge": False},
        )
        self.assertEqual(len(result), 1)
        self.assertIn("Post-merge", result[0])

    def test_fires_when_ops_none(self):
        """Backward-compat: None ops falls through to signal-based check."""
        result = post_merge_messages(
            signals=["code-changed"],
            has_messages=False,
            ops=None,
        )
        self.assertEqual(len(result), 1)

    def test_no_signal_no_messages_returns_fallback(self):
        """No code-changed + no messages → generic reminder (unchanged behavior)."""
        result = post_merge_messages(
            signals=[],
            has_messages=False,
            ops={"merge": False},
        )
        self.assertEqual(len(result), 1)
        self.assertIn("confirm checks", result[0])

    def test_no_signal_has_messages_returns_empty(self):
        """No code-changed + already has messages → no additional message."""
        result = post_merge_messages(
            signals=[],
            has_messages=True,
            ops={"merge": False},
        )
        self.assertEqual(result, [])


class TestCodeChangedGatedOnRecentCommits(unittest.TestCase):
    """Gap 2 (#2005): code-changed only emitted when recent-commits present."""

    def _run_detect(self, recent_stdout: str, diff_stdout: str) -> list[str]:
        """Helper: mock git subprocess and return detect_session_signals result."""
        from git_checks import detect_session_signals

        call_count = {"n": 0}

        def fake_run(cmd, **_kw):
            r = MagicMock()
            r.returncode = 0
            if "log" in cmd:
                r.stdout = recent_stdout
            else:
                r.stdout = diff_stdout
            call_count["n"] += 1
            return r

        with patch("git_checks.subprocess.run", side_effect=fake_run):
            return detect_session_signals("/fake/cwd")

    def test_code_changed_requires_recent_commits(self):
        """code-changed is NOT emitted when there are no recent commits."""
        signals = self._run_detect(
            recent_stdout="",  # no recent commits
            diff_stdout="scripts/global/some.js\n",
        )
        self.assertNotIn("code-changed", signals)
        self.assertNotIn("extension-changed", signals)

    def test_code_changed_emitted_with_recent_commits(self):
        """code-changed IS emitted when recent commits and diff shows .js files."""
        signals = self._run_detect(
            recent_stdout="abc1234 feat: something",
            diff_stdout="scripts/global/some.js\n",
        )
        self.assertIn("recent-commits", signals)
        self.assertIn("code-changed", signals)

    def test_docs_updated_independent_of_recent_commits(self):
        """docs-updated does not require recent-commits (independent signal)."""
        signals = self._run_detect(
            recent_stdout="",  # no recent commits
            diff_stdout="CHANGELOG.md\n",
        )
        self.assertIn("docs-updated", signals)
        self.assertNotIn("code-changed", signals)

    def test_extension_changed_requires_recent_commits(self):
        """extension-changed is NOT emitted without recent-commits."""
        signals = self._run_detect(
            recent_stdout="",
            diff_stdout="vscode-extension/src/foo.ts\n",
        )
        self.assertNotIn("extension-changed", signals)

    def test_extension_changed_with_recent_commits(self):
        """extension-changed IS emitted when recent commits and extension path."""
        signals = self._run_detect(
            recent_stdout="abc1234 feat: ext change",
            diff_stdout="vscode-extension/src/foo.ts\n",
        )
        self.assertIn("extension-changed", signals)


if __name__ == "__main__":
    unittest.main()
