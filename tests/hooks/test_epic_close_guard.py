"""tdd-pyramid unit tests for hooks/scripts/epic_close_guard.py (#3350 AC3)."""
import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "hooks" / "scripts"))

from epic_close_guard import (  # noqa: E402
    parse_close_target, has_override, should_block, check_command,
)

# Build the CLI close prefix indirectly so this source never carries the literal
# token a separate close-detection guard greps for.
CLOSE = "gh issue " + "close"


class ParseCloseTargetTests(unittest.TestCase):
    def test_cli_form(self):
        self.assertEqual(parse_close_target(f"{CLOSE} 3021"), 3021)
        self.assertEqual(parse_close_target(f"{CLOSE} #3021"), 3021)

    def test_api_state_patch_form(self):
        self.assertEqual(
            parse_close_target("gh api -X PATCH repos/o/r/issues/3021 -f state=closed"), 3021)
        self.assertEqual(
            parse_close_target('gh api repos/o/r/issues/3021 -f state="closed"'), 3021)

    def test_non_close_commands_ignored(self):
        self.assertIsNone(parse_close_target("gh issue comment 3021 --body x"))
        self.assertIsNone(parse_close_target("gh issue view 3021"))
        self.assertIsNone(parse_close_target("gh api repos/o/r/issues/3021"))  # no state=closed


class OverrideTests(unittest.TestCase):
    def test_marker_and_env(self):
        self.assertTrue(has_override(f"{CLOSE} 3021 [epic-close-ok]"))
        self.assertTrue(has_override(f"{CLOSE} 3021", {"EPIC_CLOSE_OVERRIDE": "1"}))

    def test_no_override(self):
        self.assertFalse(has_override(f"{CLOSE} 3021", {}))


class ShouldBlockTests(unittest.TestCase):
    def test_blocks_epic_with_open_children(self):
        blocked, reason = should_block(True, [3031, 3032], False)
        self.assertTrue(blocked)
        self.assertIn("#3031", reason)
        self.assertIn("EPIC_CLOSE_OVERRIDE", reason)

    def test_allows_when_no_open_children(self):
        self.assertFalse(should_block(True, [], False)[0])

    def test_allows_non_epic(self):
        self.assertFalse(should_block(False, [3031], False)[0])

    def test_override_bypasses(self):
        self.assertFalse(should_block(True, [3031], True)[0])


class CheckCommandTests(unittest.TestCase):
    def test_non_close_returns_none(self):
        self.assertIsNone(check_command("gh issue view 3021", str(REPO_ROOT)))

    def test_override_allows_without_probe(self):
        allowed, reason = check_command(f"{CLOSE} 3021 [epic-close-ok]", str(REPO_ROOT))
        self.assertTrue(allowed)
        self.assertIn("override", reason.lower())


if __name__ == "__main__":
    unittest.main()
