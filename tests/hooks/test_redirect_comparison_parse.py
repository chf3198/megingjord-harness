"""#3057: Regression tests for redirect parser vs at-or-above-N comparisons.

The pretool_guard redirect scanner MUST NOT treat a quoted/heredoc `>=93`
(or similar comparison token) as a shell redirect target. Real redirects
(`> file`, `>> file` outside quotes) MUST still be caught.

The fix lives in pretool_guard._sanitize_for_redirect_scan (heredoc body
stripping + quoted span masking, #3471). These tests anchor the behavior
so it cannot regress when admin_review_rating: >=93 is added (#3053/#3055).
"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[2] / "hooks" / "scripts"
sys.path.insert(0, str(SCRIPTS))

from pretool_guard import shell_write_targets  # noqa: E402


class TestQuotedComparisonNotBlocked(unittest.TestCase):
    """Quoted >=N comparisons must NOT be parsed as redirect targets."""

    def test_double_quoted_gte93(self):
        cmd = 'gh issue comment 3053 --body "admin_review_rating: >=93"'
        self.assertEqual(shell_write_targets(cmd), [])

    def test_single_quoted_gte93(self):
        cmd = "echo 'admin_review_rating: >=93'"
        self.assertEqual(shell_write_targets(cmd), [])

    def test_backtick_quoted_gte(self):
        cmd = "echo `rating >=93`"
        self.assertEqual(shell_write_targets(cmd), [])

    def test_unquoted_gte93_not_a_redirect(self):
        """Unquoted >=93: the (?!=) negative lookahead rejects > followed by =."""
        cmd = "echo admin_review_rating >= 93"
        self.assertEqual(shell_write_targets(cmd), [])


class TestHeredocComparisonNotBlocked(unittest.TestCase):
    """>=N inside a heredoc body must NOT be parsed as a redirect target."""

    def test_heredoc_body_gte93_stripped(self):
        cmd = "cat > body.txt <<'EOF'\nadmin_review_rating: >=93\nEOF"
        targets = shell_write_targets(cmd)
        # Only the real redirect `> body.txt` is caught
        self.assertIn("body.txt", targets)
        self.assertNotIn(">=93", targets)
        self.assertNotIn("93", targets)

    def test_heredoc_dasheof_gte_stripped(self):
        cmd = "cat > out.txt <<-DELIM\n  threshold >=50\nDELIM"
        targets = shell_write_targets(cmd)
        self.assertIn("out.txt", targets)
        self.assertNotIn("50", targets)


class TestRealRedirectStillCaught(unittest.TestCase):
    """Real redirects outside quotes MUST still be caught."""

    def test_simple_redirect(self):
        targets = shell_write_targets("echo hello > output.txt")
        self.assertIn("output.txt", targets)

    def test_append_redirect(self):
        targets = shell_write_targets("echo hello >> log.txt")
        self.assertIn("log.txt", targets)

    def test_fd_redirect_to_file(self):
        targets = shell_write_targets("cmd 2> errors.log")
        self.assertIn("errors.log", targets)

    def test_tee_target(self):
        targets = shell_write_targets("echo data | tee result.json")
        self.assertIn("result.json", targets)


if __name__ == "__main__":
    unittest.main()
