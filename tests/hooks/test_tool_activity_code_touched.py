"""Tests for #2978: code_touched set only on real mutations, never on read-only tools."""
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

REPO_ROOT = Path(__file__).resolve().parents[2]
HOOKS = REPO_ROOT / "hooks" / "scripts"
sys.path.insert(0, str(HOOKS))

import tool_activity as ta  # noqa: E402
from admin_patterns import required_admin_ops  # noqa: E402


def _mark(tool, tool_input):
    state: dict = {}
    ta.mark_tool_activity(state, {"tool_name": tool, "tool_input": tool_input})
    return state.get("flags", {})


class CodeTouchedReadOnly(unittest.TestCase):
    def test_AC1_read_only_tools_do_not_flip_code_touched(self):
        for tool in ("Read", "Grep", "Glob", "read_file", "grep_search", "file_search"):
            flags = _mark(tool, {"file_path": "scripts/global/cascade-dispatch.js", "pattern": "foo"})
            self.assertNotEqual(flags.get("code_touched"), True, f"{tool} must not flip code_touched")

    def test_AC1_readonly_bash_grep_does_not_flip(self):
        flags = _mark("Bash", {"command": "grep -rn 'foo' scripts/global/*.js && sed -n '1,5p' a.md"})
        self.assertNotEqual(flags.get("code_touched"), True)

    def test_AC2_no_mutation_means_required_admin_ops_empty(self):
        flags = _mark("Grep", {"pattern": "x", "path": "scripts/global/foo.js"})
        self.assertEqual(required_admin_ops(flags, "node"), [])

    def test_AC3_edit_write_flip_code_touched(self):
        for tool in ("Edit", "Write", "MultiEdit", "apply_patch"):
            flags = _mark(tool, {"file_path": "scripts/global/foo.js"})
            self.assertEqual(flags.get("code_touched"), True, f"{tool} must flip code_touched")

    def test_AC3_bash_mutation_confirmed_by_git_diff_flips(self):
        # cheap pre-filter matches AND git diff reports a tracked code file changed -> code_touched
        with patch.object(ta, "_bash_mutated_tracked_paths", return_value=["scripts/global/foo.js"]):
            flags = _mark("Bash", {"command": "echo 'x' > scripts/global/foo.js"})
        self.assertEqual(flags.get("code_touched"), True)

    def test_AC4_failsafe_unknown_nonbash_tool_with_code_path_flips(self):
        # an unknown (non-read-only, non-Bash) tool still flips — denylist, not whitelist
        flags = _mark("some_future_mutator", {"file_path": "scripts/global/foo.js"})
        self.assertEqual(flags.get("code_touched"), True)

    def test_docs_only_read_does_not_flip_docs_touched(self):
        flags = _mark("Read", {"file_path": "docs/howto/thing.md"})
        self.assertNotEqual(flags.get("docs_touched"), True)


class BashMutatedPaths(unittest.TestCase):
    def test_read_only_command_short_circuits_no_git_call(self):
        # no mutating pattern -> returns [] without invoking git
        self.assertEqual(ta._bash_mutated_tracked_paths("grep -rn foo scripts/"), [])

    def test_git_failure_returns_empty_never_raises(self):
        with patch.object(ta.subprocess, "run", side_effect=Exception("boom")):
            self.assertEqual(ta._bash_mutated_tracked_paths("echo x > a.js"), [])


if __name__ == "__main__":
    unittest.main()
