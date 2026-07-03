"""#3266 AC2: non-repo / scratchpad execution must NOT flip code_touched.

Extends #2978 (read-only + repo-path Bash cases already hardened) to the remaining gap:
Edit/Write-class mutations targeting a path OUTSIDE the tracked repo working tree
(scratchpad, /tmp, ~/.claude). Only a real in-repo change may flip a touch flag; the
classifier is fail-SAFE when git cannot resolve the repo root (governance errs toward flagging).
"""
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

REPO_ROOT = Path(__file__).resolve().parents[2]
HOOKS = REPO_ROOT / "hooks" / "scripts"
sys.path.insert(0, str(HOOKS))

import tool_activity as ta  # noqa: E402


def _mark(tool, tool_input):
    state: dict = {}
    ta.mark_tool_activity(state, {"tool_name": tool, "tool_input": tool_input})
    return state.get("flags", {})


class NonRepoDoesNotFlip(unittest.TestCase):
    def test_AC2_scratchpad_write_does_not_flip_code_touched(self):
        # repo root resolved -> an absolute /tmp scratchpad path is outside it -> no flip.
        with patch.object(ta, "_repo_root", return_value=str(REPO_ROOT)):
            flags = _mark("Write", {"file_path": "/tmp/claude-xyz/scratchpad/probe.js"})
        self.assertNotEqual(flags.get("code_touched"), True)

    def test_AC2_home_dot_claude_write_does_not_flip(self):
        with patch.object(ta, "_repo_root", return_value=str(REPO_ROOT)):
            flags = _mark("Edit", {"file_path": "/home/someone/.claude/settings.json"})
        self.assertNotEqual(flags.get("code_touched"), True)

    def test_AC2_bash_running_scratchpad_script_does_not_flip(self):
        # `node /tmp/probe.js` is not a mutating pre-filter match -> no candidate paths at all.
        flags = _mark("Bash", {"command": "node /tmp/claude-xyz/probe.js --diagnose"})
        self.assertNotEqual(flags.get("code_touched"), True)

    def test_AC2_in_repo_write_still_flips(self):
        # Regression guard: a genuine in-repo edit (absolute, under root) still flips.
        with patch.object(ta, "_repo_root", return_value=str(REPO_ROOT)):
            flags = _mark("Write", {"file_path": str(REPO_ROOT / "hooks/scripts/foo.py")})
        self.assertEqual(flags.get("code_touched"), True)

    def test_AC2_relative_in_repo_write_still_flips(self):
        with patch.object(ta, "_repo_root", return_value=str(REPO_ROOT)):
            flags = _mark("Write", {"file_path": "scripts/global/foo.js"})
        self.assertEqual(flags.get("code_touched"), True)

    def test_failsafe_unresolved_repo_root_still_flips(self):
        # git can't resolve root -> denylist fail-safe: still flag (never silently miss).
        with patch.object(ta, "_repo_root", return_value=None):
            flags = _mark("Write", {"file_path": "/tmp/claude-xyz/probe.js"})
        self.assertEqual(flags.get("code_touched"), True)


class PathInRepoUnit(unittest.TestCase):
    def test_none_root_is_failsafe_true(self):
        self.assertTrue(ta._path_in_repo("/tmp/x.js", None))

    def test_outside_path_false(self):
        self.assertFalse(ta._path_in_repo("/tmp/x.js", str(REPO_ROOT)))

    def test_inside_path_true(self):
        self.assertTrue(ta._path_in_repo(str(REPO_ROOT / "a/b.py"), str(REPO_ROOT)))

    def test_sibling_prefix_not_matched(self):
        # a sibling dir sharing a name prefix must not count as inside (os.sep boundary).
        self.assertFalse(ta._path_in_repo(str(REPO_ROOT) + "-sibling/x.py", str(REPO_ROOT)))


if __name__ == "__main__":
    unittest.main()
