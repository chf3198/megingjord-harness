"""#2770 - Python parity of the env-hydration shim: 5-clause contract + fail-closed require_keys."""
import os
import subprocess
import sys
import tempfile
import unittest

HOOKS = os.path.join(os.path.dirname(__file__), "..", "..", "hooks", "scripts")
sys.path.insert(0, os.path.abspath(HOOKS))

import load_local_env as lle  # noqa: E402


class ParseEnv(unittest.TestCase):
    def test_parses_skips_comments_blanks_and_strips_export_quotes(self):
        pairs = dict(lle.parse_env('# c\n\nexport A=1\nB="two"\nC=\'three\'\n=bad\nD\n'))
        self.assertEqual(pairs, {"A": "1", "B": "two", "C": "three"})


class Hydrate(unittest.TestCase):
    def test_fill_dont_override(self):
        env = {"KEEP": "real"}
        with tempfile.NamedTemporaryFile("w", suffix=".env", delete=False) as fh:
            fh.write("KEEP=from_dotenv\nNEW=v\n")
            path = fh.name
        lle.load_local_env(env=env, path=path, quiet=True)
        self.assertEqual(env["KEEP"], "real")   # real value wins
        self.assertEqual(env["NEW"], "v")        # absent key filled

    def test_graceful_on_missing_file(self):
        self.assertEqual(lle.load_local_env(env={}, path="/no/such/.env", quiet=True)["skipped"], "missing")

    def test_opt_out_env_flag(self):
        self.assertEqual(lle.load_local_env(env={"MEGINGJORD_NO_DOTENV": "1"}, quiet=True)["skipped"], "disabled")

    def test_relocate_via_env_var(self):
        with tempfile.NamedTemporaryFile("w", suffix=".env", delete=False) as fh:
            fh.write("RELOC=yes\n")
            path = fh.name
        env = {"MEGINGJORD_DOTENV_PATH": path}
        lle.load_local_env(env=env, quiet=True)
        self.assertEqual(env["RELOC"], "yes")


class RequireKeys(unittest.TestCase):
    def test_present_key_ok(self):
        self.assertEqual(lle.require_keys("X", env={"X": "1"}), {"ok": True, "absent": []})

    def test_absent_optional_reports_without_raising(self):
        self.assertEqual(lle.require_keys("Y", env={}, throw_on_absent=False), {"ok": False, "absent": ["Y"]})

    def test_absent_required_raises_failclosed_never_prompts(self):
        with self.assertRaises(lle.CredentialAbsent) as ctx:
            lle.require_keys("Z", env={})
        self.assertEqual(ctx.exception.code, "CREDENTIAL_ABSENT")
        self.assertEqual(ctx.exception.absent, ["Z"])
        self.assertIn("never prompt the client", str(ctx.exception))

    def test_empty_string_counts_as_absent(self):
        self.assertFalse(lle.require_keys("E", env={"E": ""}, throw_on_absent=False)["ok"])


class FreshProcessVisibility(unittest.TestCase):
    def test_fresh_empty_env_resolves_from_dotenv_and_absent_stays_absent(self):
        with tempfile.NamedTemporaryFile("w", suffix=".env", delete=False) as fh:
            fh.write("PY_FROM_DOTENV=hi\n")
            path = fh.name
        code = ("import os,sys; sys.path.insert(0, os.path.abspath(%r)); import load_local_env as l; "
                "l.load_local_env_once(); "
                "print(os.environ.get('PY_FROM_DOTENV'), os.environ.get('PY_NEVER'))" % os.path.abspath(HOOKS))
        out = subprocess.check_output([sys.executable, "-c", code],
                                      env={"MEGINGJORD_DOTENV_PATH": path, "PATH": os.environ.get("PATH", "")},
                                      text=True).strip()
        self.assertEqual(out, "hi None")  # visible-where-intended, absent-where-not


if __name__ == "__main__":
    unittest.main()
