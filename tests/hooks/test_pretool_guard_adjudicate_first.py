"""Unit tests for the Epic #3392 AC2/AC5 adjudicate-first remediation of the 2 security-sensitive
surfaces in pretool_guard (S6 hook-script mutation, S7 sensitive-file path, #3403).

The guard becomes precise instead of blanket: benign access (hook read / governed deploy /
gitignored-local secret read) proceeds, while genuine policy-weakening hook mutation or
tracked-secret exposure still reaches the human carve-out (ask). FAIL-CLOSED: any classifier error
returns "ask" so a bug can never silently weaken G4.
"""
import os
import sys
import unittest
from unittest import mock

HOOKS = os.path.join(os.path.dirname(__file__), "..", "..", "hooks", "scripts")
sys.path.insert(0, os.path.abspath(HOOKS))

import pretool_guard  # noqa: E402
from runtime_paths import runtime_hook_paths  # noqa: E402

HOOK_PATH = runtime_hook_paths()[0]  # a real runtime hook directory


class HookMutationClassifier(unittest.TestCase):
    def test_read_of_hook_path_is_allowed(self):
        self.assertEqual(pretool_guard.classify_hook_mutation(f"cat {HOOK_PATH}/pretool_guard.py"), "allow")

    def test_grep_of_hook_path_is_allowed(self):
        self.assertEqual(pretool_guard.classify_hook_mutation(f"grep -n emit {HOOK_PATH}/x.py"), "allow")

    def test_direct_write_to_hook_path_asks(self):
        self.assertEqual(pretool_guard.classify_hook_mutation(f"cp evil.py {HOOK_PATH}/pretool_guard.py"), "ask")

    def test_redirect_write_to_hook_path_asks(self):
        self.assertEqual(pretool_guard.classify_hook_mutation(f"echo x >> {HOOK_PATH}/pretool_guard.py"), "ask")

    def test_governed_deploy_writing_hook_path_is_allowed(self):
        self.assertEqual(
            pretool_guard.classify_hook_mutation(f"npm run deploy:apply && cp x {HOOK_PATH}/y.py"), "allow")

    def test_no_hook_path_is_allowed(self):
        self.assertEqual(pretool_guard.classify_hook_mutation("cat README.md"), "allow")

    def test_bare_deploy_token_does_not_authorize_a_mutation(self):
        # Cross-family review hardening: a bare `deploy:malicious` token must NOT be treated as a
        # governed deploy — an attacker appending it to a hook write still reaches the carve-out.
        self.assertEqual(
            pretool_guard.classify_hook_mutation(f"cp evil {HOOK_PATH}/p.py && echo deploy:malicious"), "ask")

    def test_real_npm_deploy_writing_hook_is_allowed(self):
        self.assertEqual(
            pretool_guard.classify_hook_mutation(f"npm run deploy:apply && cp x {HOOK_PATH}/y.py"), "allow")

    def test_none_command_mutates_nothing_is_allowed(self):
        # A non-string mutates no hook (shell_write_targets fails open to []), so it is benign.
        self.assertEqual(pretool_guard.classify_hook_mutation(None), "allow")

    def test_fail_closed_when_a_dependency_raises(self):
        # If the path resolver itself raises, the classifier MUST fail closed to ask (never weaken G4).
        with mock.patch.object(pretool_guard, "runtime_hook_paths", side_effect=RuntimeError("boom")):
            self.assertEqual(pretool_guard.classify_hook_mutation(f"cp x {HOOK_PATH}/y"), "ask")


class SensitivePathClassifier(unittest.TestCase):
    def test_gitignored_local_secret_read_is_allowed(self):
        with mock.patch.object(pretool_guard, "evaluate_path", return_value=(True, "gitignored")):
            self.assertEqual(pretool_guard.classify_sensitive_path([".env"], "/cwd"), "allow")

    def test_tracked_secret_path_asks(self):
        with mock.patch.object(pretool_guard, "evaluate_path", return_value=(False, "tracked")):
            self.assertEqual(pretool_guard.classify_sensitive_path(["secrets/prod.key"], "/cwd"), "ask")

    def test_env_example_is_not_secret(self):
        self.assertEqual(pretool_guard.classify_sensitive_path([".env.example"], "/cwd"), "allow")

    def test_no_secret_path_is_allowed(self):
        self.assertEqual(pretool_guard.classify_sensitive_path(["src/app.js"], "/cwd"), "allow")

    def test_mixed_one_tracked_secret_asks(self):
        def fake(path, _cwd):
            return (False, "tracked") if "prod" in path else (True, "ignored")
        with mock.patch.object(pretool_guard, "evaluate_path", side_effect=fake):
            self.assertEqual(pretool_guard.classify_sensitive_path([".env", "config/prod.pem"], "/cwd"), "ask")

    def test_fail_closed_when_evaluate_path_raises(self):
        with mock.patch.object(pretool_guard, "evaluate_path", side_effect=RuntimeError("boom")):
            self.assertEqual(pretool_guard.classify_sensitive_path([".env"], "/cwd"), "ask")


class AntiGoalPreserved(unittest.TestCase):
    """The human carve-out is PRESERVED for genuine risk — no security control removed."""

    def test_ungoverned_hook_mutation_still_reaches_carveout(self):
        self.assertEqual(pretool_guard.classify_hook_mutation(f"sed -i s/deny/allow/ {HOOK_PATH}/x.py"), "ask")

    def test_tracked_secret_exposure_still_reaches_carveout(self):
        with mock.patch.object(pretool_guard, "evaluate_path", return_value=(False, "tracked")):
            self.assertEqual(pretool_guard.classify_sensitive_path(["committed/id_rsa"], "/cwd"), "ask")


if __name__ == "__main__":
    unittest.main()
