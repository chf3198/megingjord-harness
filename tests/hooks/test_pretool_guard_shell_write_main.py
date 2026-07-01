"""Canonical-main SHELL-LEVEL-write guard tests (#2995).

Closes the documented blind spot where terminal writes (redirect / sed -i / tee /
cp / mv) mutate tracked main files, bypassing the structured-edit-tool enforcer.
evaluate_path() is the deny/allow authority; these tests pin both the extractor
(shell_write_targets) and the check_terminal integration, incl. the IT-marker
non-authorization (AC3) and the no-over-block guarantee (AC2)."""
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "hooks" / "scripts"))

import pretool_guard  # noqa: E402


class ShellWriteTargetExtractor(unittest.TestCase):
    """Unit: shell_write_targets covers the common write idioms, excludes fd-dups + dev sinks."""

    def test_redirect_truncate(self):
        self.assertIn("foo.py", pretool_guard.shell_write_targets("echo x > foo.py"))

    def test_redirect_append(self):
        self.assertIn("bar.txt", pretool_guard.shell_write_targets("cat a >> bar.txt"))

    def test_sed_inplace(self):
        self.assertIn("baz.py", pretool_guard.shell_write_targets("sed -i 's/a/b/' baz.py"))

    def test_tee(self):
        self.assertIn("qux.md", pretool_guard.shell_write_targets("echo x | tee qux.md"))

    def test_cp_dest(self):
        self.assertIn("dest.js", pretool_guard.shell_write_targets("cp src.js dest.js"))

    def test_mv_dest(self):
        self.assertIn("b.py", pretool_guard.shell_write_targets("mv a.py b.py"))

    def test_dd_of(self):
        # #2995 cross-family review: dd of=PATH is a non-redirect file writer.
        self.assertIn("out.bin", pretool_guard.shell_write_targets("dd if=/dev/zero of=out.bin bs=1M count=1"))

    def test_dev_null_excluded(self):
        self.assertEqual(pretool_guard.shell_write_targets("echo x > /dev/null"), [])

    def test_fd_dup_excluded(self):
        # 2>&1 and >&2 are fd redirects, not file writes.
        self.assertEqual(pretool_guard.shell_write_targets("run_cmd 2>&1"), [])
        self.assertEqual(pretool_guard.shell_write_targets("run_cmd >&2"), [])

    def test_arrow_minus_not_a_redirect(self):
        # #3001: `a -> b` must NOT be parsed as a redirect (was over-blocking).
        self.assertEqual(pretool_guard.shell_write_targets("echo 'step a -> step b'"), [])

    def test_arrow_equals_not_a_redirect(self):
        # #3001: `x => y` (fat arrow) must NOT be parsed as a redirect.
        self.assertEqual(pretool_guard.shell_write_targets("echo 'map x => y'"), [])

    def test_inline_gt_not_a_redirect(self):
        # #3001: inline `a>b` (no boundary) is not treated as an output redirect.
        self.assertEqual(pretool_guard.shell_write_targets("test $a>b"), [])

    def test_fd_redirect_to_file_still_caught(self):
        # A genuine fd redirect to a file IS still a write target.
        self.assertIn("err.log", pretool_guard.shell_write_targets("run 2> err.log"))

    def test_redirect_multiple_spaces_and_tabs(self):
        # #3001 review nit: whitespace between operator and target is tolerated.
        self.assertIn("out.txt", pretool_guard.shell_write_targets("echo x >    out.txt"))
        self.assertIn("o2.txt", pretool_guard.shell_write_targets("echo x >\to2.txt"))

    def test_tmp_extracted_but_harmless(self):
        # Extracted, but evaluate_path will ALLOW a non-repo target — extractor stays generous.
        self.assertIn("/tmp/out", pretool_guard.shell_write_targets("ls > /tmp/out"))

    def test_malformed_failopen(self):
        # Never raise — fail-open returns a list (possibly empty).
        self.assertIsInstance(pretool_guard.shell_write_targets(">>>|&;"), list)


class CheckTerminalShellWriteGuard(unittest.TestCase):
    """Integration: check_terminal denies tracked-main shell writes, allows the rest."""

    def _state(self):
        return {"flags": {}, "admin_ops": {}, "repo_type": "generic"}

    def _run(self, cmd, *, path_allowed):
        """Run check_terminal in a simulated main checkout; evaluate_path stubbed
        to (path_allowed, reason). Returns the captured (decision, reason)."""
        captured = {}

        def fake_emit(decision, reason, extra=None):
            captured["decision"] = decision
            captured["reason"] = reason
            return 0

        with patch("pretool_guard.is_main_checkout", return_value=True), \
                patch("pretool_guard.active_ticket_is_no_code_lane", return_value=False), \
                patch("pretool_guard.evaluate_path",
                      return_value=(path_allowed, "tracked" if not path_allowed else "gitignored")), \
                patch("pretool_guard.emit", side_effect=fake_emit):
            pretool_guard.check_terminal(cmd, self._state(), str(REPO_ROOT))
        return captured

    def test_tracked_main_shell_write_denied(self):
        # AC1: write to a tracked main file via redirect is DENIED with worktree guidance.
        cap = self._run("echo x > hooks/scripts/pretool_guard.py", path_allowed=False)
        self.assertEqual(cap.get("decision"), "deny")
        self.assertIn("worktree", cap.get("reason", ""))

    def test_gitignored_shell_write_allowed(self):
        # AC2: write to a gitignored/non-repo path must NOT be denied by this guard (no over-block).
        cap = self._run("echo x > .env", path_allowed=True)
        self.assertNotEqual(cap.get("decision"), "deny")

    def test_it_marker_does_not_authorize_tracked_write(self):
        # AC3: an IT-ops marker in the command does NOT waive canonical-main read-only.
        cap = self._run("echo cfg > config/governance-rules.yaml # [it-ops]", path_allowed=False)
        self.assertEqual(cap.get("decision"), "deny")
        self.assertIn("IT-ops markers do NOT authorize", cap.get("reason", ""))

    def test_sed_inplace_tracked_main_denied(self):
        cap = self._run("sed -i 's/a/b/' scripts/lint.js", path_allowed=False)
        self.assertEqual(cap.get("decision"), "deny")

    def test_non_main_checkout_skips_guard(self):
        # In a worktree (is_main_checkout False) the shell-write guard does not fire.
        captured = {}

        def fake_emit(decision, reason, extra=None):
            captured["decision"] = decision
            return 0

        with patch("pretool_guard.is_main_checkout", return_value=False), \
                patch("pretool_guard.active_ticket_is_no_code_lane", return_value=False), \
                patch("pretool_guard.emit", side_effect=fake_emit):
            pretool_guard.check_terminal("echo x > hooks/scripts/pretool_guard.py",
                                         self._state(), "/home/u/devenv-ops-2995")
        self.assertNotEqual(captured.get("decision"), "deny")


class RedirectFalsePositiveGuard(unittest.TestCase):
    """#3471: PROSE `>`/`>=` (quoted, here-doc body, or a comparison) is NOT a redirect,
    while a genuine redirect to an unquoted target is still caught (anti-over-suppress)."""

    def test_quoted_gt_prose_not_redirect(self):
        self.assertEqual(pretool_guard.shell_write_targets("echo 'G2 > G3'"), [])

    def test_double_quoted_gt_prose_not_redirect(self):
        self.assertEqual(pretool_guard.shell_write_targets('echo "score > 90"'), [])

    def test_gte_comparison_not_redirect(self):
        self.assertEqual(pretool_guard.shell_write_targets("echo aggregate >= 0.85"), [])

    def test_gt_and_gte_literal_not_redirect(self):
        self.assertEqual(pretool_guard.shell_write_targets("echo '> and >='"), [])

    def test_heredoc_body_gt_not_redirect(self):
        cmd = "gh issue comment 1 --body-file - <<EOF\nG1 > G2 > G10\nEOF"
        self.assertEqual(pretool_guard.shell_write_targets(cmd), [])

    def test_heredoc_quoted_delim_body_not_redirect(self):
        cmd = "cat <<'EOF'\nrubric >= 0.85 and G1 > G2\nEOF"
        self.assertEqual(pretool_guard.shell_write_targets(cmd), [])

    def test_genuine_redirect_beside_quoted_prose_still_caught(self):
        # AC4: a real redirect OUTSIDE quotes is still detected even next to quoted prose.
        self.assertIn("out.js", pretool_guard.shell_write_targets("echo 'a > b' > out.js"))

    def test_append_after_prose_still_caught(self):
        self.assertIn("t.js", pretool_guard.shell_write_targets("printf 'x >= y' >> t.js"))

    def test_unterminated_quote_failopen(self):
        # never raise on malformed input; a masked span is harmless.
        self.assertIsInstance(pretool_guard.shell_write_targets("echo 'oops > x"), list)


class CommandStringScoping(unittest.TestCase):
    """#3471 AC3: only the command field is scanned, never the description metadata field."""

    def test_command_field_extracted(self):
        self.assertEqual(
            pretool_guard._command_string({"command": "ls -l", "description": "writes >> nothing"}),
            "ls -l")

    def test_description_gt_not_scanned(self):
        tool_input = {"command": "ls", "description": "this tool writes > to a file, uses >="}
        scanned = pretool_guard.shell_write_targets(pretool_guard._command_string(tool_input))
        self.assertEqual(scanned, [])

    def test_fallback_joins_when_no_command_field(self):
        self.assertIn("hello", pretool_guard._command_string({"foo": "hello"}))


if __name__ == "__main__":
    unittest.main()
