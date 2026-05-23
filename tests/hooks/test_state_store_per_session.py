"""Tests for C5: state_store.py per-session state path — AC1-AC4."""
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent.parent.parent / "hooks" / "scripts"))


class TestStateStorePerSession(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.home = tempfile.mkdtemp()
        self.state_dir = Path(self.home) / ".copilot" / "hooks" / "state"
        self.state_dir.mkdir(parents=True)

    def _path_for(self, sid_env=None, sid_file=None):
        env_patch = {}
        if sid_env:
            env_patch["MEGINGJORD_SESSION_ID"] = sid_env
        else:
            env_patch.pop("MEGINGJORD_SESSION_ID", None)
        megingjord = Path(self.home) / ".megingjord"
        megingjord.mkdir(parents=True, exist_ok=True)
        sid_f = megingjord / "session.id"
        if sid_file:
            sid_f.write_text(sid_file)
        elif sid_f.exists():
            sid_f.unlink()
        with patch.dict(os.environ, env_patch, clear=False):
            if "MEGINGJORD_SESSION_ID" not in env_patch:
                os.environ.pop("MEGINGJORD_SESSION_ID", None)
            with patch("runtime_paths.state_root", return_value=self.state_dir):
                with patch("pathlib.Path.home", return_value=Path(self.home)):
                    import importlib
                    import state_store
                    importlib.reload(state_store)
                    return state_store.state_path(self.tmp)

    def test_ac1_includes_session_id_prefix(self):
        """AC1: state path includes session ID short prefix (first 8 chars)."""
        p = self._path_for(sid_env="abcdef12-0000-4000-8000-000000000000")
        self.assertIn("abcdef12", str(p), "Path should include first 8 chars of session ID")

    def test_ac2_falls_back_to_nosession(self):
        """AC2: falls back to 'nosession' when no session ID available."""
        p = self._path_for(sid_env=None, sid_file=None)
        self.assertIn("nosession", str(p))

    def test_ac3_env_takes_precedence_over_file(self):
        """AC3: MEGINGJORD_SESSION_ID env var takes precedence over file."""
        p = self._path_for(sid_env="envfirst-0000-4000-8000-000000000000",
                           sid_file="filefirst-xxxx")
        self.assertIn("envfirst", str(p))
        self.assertNotIn("filefirst", str(p))

    def test_ac4_same_call_signature(self):
        """AC4: state_path(cwd) call signature unchanged."""
        import importlib
        with patch("runtime_paths.state_root", return_value=self.state_dir):
            with patch.dict(os.environ, {"MEGINGJORD_SESSION_ID": "test1234"}):
                import state_store
                importlib.reload(state_store)
                p = state_store.state_path(self.tmp)
                self.assertIsInstance(p, Path)

    def test_ac1_file_fallback(self):
        """AC1 (file): session short from ~/.megingjord/session.id when no env."""
        p = self._path_for(sid_env=None, sid_file="file5678-0000-4000-8000-000000000000")
        self.assertIn("file5678", str(p))


if __name__ == "__main__":
    unittest.main()
