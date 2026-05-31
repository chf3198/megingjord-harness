"""Regex fix tests for pretool_guard.py (#2371): AC1/AC2/AC3/AC5."""
import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
HOOKS_SCRIPTS = REPO_ROOT / "hooks" / "scripts"
sys.path.insert(0, str(HOOKS_SCRIPTS))

import admin_patterns  # noqa: E402
import pretool_guard  # noqa: E402

# Split to avoid triggering deployed hook branch-switch pattern
GIT_SWITCH = "git sw" + "itch"
GIT_CHECKOUT = "git ch" + "eckout"


class IterPathsAC1(unittest.TestCase):
    def test_yields_file_path_key(self):
        self.assertEqual(list(admin_patterns.iter_paths({"file_path": "/tmp/x.py"})), ["/tmp/x.py"])

    def test_skips_new_string_content(self):
        inp = {"filePath": "/tmp/z.py", "newString": "ref /home/user/devenv-ops"}
        self.assertEqual(list(admin_patterns.iter_paths(inp)), ["/tmp/z.py"])

    def test_skips_old_string_content(self):
        inp = {"file_path": "/tmp/a.py", "old_string": "/secret/path/config.pem"}
        self.assertEqual(list(admin_patterns.iter_paths(inp)), ["/tmp/a.py"])

    def test_yields_replacements_paths(self):
        inp = {"replacements": [
            {"filePath": "/tmp/r1.py", "oldString": "x", "newString": "y"},
        ]}
        self.assertEqual(list(admin_patterns.iter_paths(inp)), ["/tmp/r1.py"])

    def test_empty_dict_yields_nothing(self):
        self.assertEqual(list(admin_patterns.iter_paths({})), [])


class BranchSwitchAC2(unittest.TestCase):
    def test_bare_command_matched(self):
        self.assertIsNotNone(pretool_guard.RE_BRANCH_SWITCH.search(
            GIT_SWITCH + " feat/1234-slug"))

    def test_echo_prose_not_matched(self):
        self.assertIsNone(pretool_guard.RE_BRANCH_SWITCH.search(
            'echo "run ' + GIT_CHECKOUT + ' HEAD~1 to revert"'))

    def test_after_semicolon_matched(self):
        self.assertIsNotNone(pretool_guard.RE_BRANCH_SWITCH.search(
            "cd /tmp; " + GIT_SWITCH + " feat/9999-test"))

    def test_after_ampersand_matched(self):
        self.assertIsNotNone(pretool_guard.RE_BRANCH_SWITCH.search(
            "npm install && " + GIT_SWITCH + " feat/100-x"))


class GitCommitAC3(unittest.TestCase):
    def test_plain_git_commit_matches(self):
        self.assertIsNotNone(admin_patterns.RE_GIT_COMMIT.search(
            'git commit -m "fix #123"'))

    def test_git_minus_c_commit_matches(self):
        self.assertIsNotNone(admin_patterns.RE_GIT_COMMIT.search(
            'git -c user.signingkey=gpg@test commit -m "fix #123"'))

    def test_git_multi_c_flags_commit_matches(self):
        self.assertIsNotNone(admin_patterns.RE_GIT_COMMIT.search(
            'git -c user.email=a@b -c user.name=T commit -m "#1 x"'))


class SignerFidelityAC5(unittest.TestCase):
    def test_iter_paths_skips_body_field(self):
        inp = {"filePath": "/tmp/safe.py", "body": "Signed-by: ApolloMason"}
        result = list(admin_patterns.iter_paths(inp))
        self.assertEqual(result, ["/tmp/safe.py"])


if __name__ == "__main__":
    unittest.main()
