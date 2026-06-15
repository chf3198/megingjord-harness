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


if __name__ == "__main__":
    unittest.main()
