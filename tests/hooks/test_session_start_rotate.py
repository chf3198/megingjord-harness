"""Tests for C2: session_start_rotate.py — AC1-AC6."""
import hashlib
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent.parent.parent / "hooks" / "scripts"))


class TestSessionStartRotate(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.home = tempfile.mkdtemp()
        self.state_root = Path(self.home) / ".copilot" / "hooks" / "state"
        self.state_root.mkdir(parents=True)
        self.cwd = self.tmp
        self.repo_key = hashlib.sha1(self.cwd.encode()).hexdigest()[:16]

    def _make_prior_state(self, sid_short: str) -> Path:
        p = self.state_root / f"repo-{self.repo_key}-{sid_short}.json"
        p.write_text(json.dumps({"cwd": self.cwd, "session": sid_short}))
        return p

    def _run_rotate(self, session_id: str):
        with patch.dict(os.environ, {"MEGINGJORD_SESSION_ID": session_id}):
            with patch("runtime_paths.state_root", return_value=self.state_root):
                import importlib
                import session_start_rotate
                importlib.reload(session_start_rotate)
                with patch.object(session_start_rotate.Path, "home",
                                  return_value=Path(self.home)):
                    session_start_rotate.rotate(self.cwd)

    def test_ac1_archives_prior_state(self):
        """AC1: archives prior session state file on session-start."""
        prior = self._make_prior_state("oldsess1")
        with patch.dict(os.environ, {"MEGINGJORD_SESSION_ID": "newsess1-0000-0000-0000-000000000000"}):
            with patch("runtime_paths.state_root", return_value=self.state_root):
                import importlib
                import session_start_rotate
                importlib.reload(session_start_rotate)
                with patch.object(session_start_rotate.Path, "home",
                                  return_value=Path(self.home)):
                    session_start_rotate.rotate(self.cwd)
        archive_dir = Path(self.home) / ".megingjord" / "state-archive" / "newsess1"
        archived = list(archive_dir.glob(f"repo-{self.repo_key}-*.json"))
        self.assertGreater(len(archived), 0, "Should have archived the prior state")
        self.assertFalse(prior.exists(), "Prior state file should be removed after archive")

    def test_ac4_fail_closed_on_rotation_error(self):
        """AC4: fail-closed — raises RuntimeError if archive write fails."""
        self._make_prior_state("oldsess2")
        with patch.dict(os.environ, {"MEGINGJORD_SESSION_ID": "newsess2-0000-0000-0000-000000000000"}):
            with patch("runtime_paths.state_root", return_value=self.state_root):
                import importlib
                import session_start_rotate
                importlib.reload(session_start_rotate)
                with patch.object(session_start_rotate.Path, "home",
                                  return_value=Path(self.home)):
                    # Make archive dir a file to force write failure
                    arc = Path(self.home) / ".megingjord" / "state-archive" / "newsess2"
                    arc.parent.mkdir(parents=True, exist_ok=True)
                    arc.write_text("not a dir")
                    with self.assertRaises((RuntimeError, NotADirectoryError, OSError)):
                        session_start_rotate.rotate(self.cwd)

    def test_ac5_orphaned_tmp_cleanup(self):
        """AC5: orphaned .tmp files in state root are cleaned on start."""
        tmp_file = self.state_root / "orphan.tmp"
        tmp_file.write_text("orphan")
        with patch.dict(os.environ, {"MEGINGJORD_SESSION_ID": "newsess3-0000-0000-0000-000000000000"}):
            with patch("runtime_paths.state_root", return_value=self.state_root):
                import importlib
                import session_start_rotate
                importlib.reload(session_start_rotate)
                with patch.object(session_start_rotate.Path, "home",
                                  return_value=Path(self.home)):
                    session_start_rotate.rotate(self.cwd)
        self.assertFalse(tmp_file.exists(), "Orphaned .tmp should be cleaned")

    def test_ac6_noop_when_no_prior_state(self):
        """AC6: no-op when no prior session state exists."""
        with patch.dict(os.environ, {"MEGINGJORD_SESSION_ID": "newsess4-0000-0000-0000-000000000000"}):
            with patch("runtime_paths.state_root", return_value=self.state_root):
                import importlib
                import session_start_rotate
                importlib.reload(session_start_rotate)
                with patch.object(session_start_rotate.Path, "home",
                                  return_value=Path(self.home)):
                    session_start_rotate.rotate(self.cwd)  # Must not raise
        # No archive dir should be created
        arc = Path(self.home) / ".megingjord" / "state-archive" / "newsess4"
        self.assertFalse(arc.exists())


if __name__ == "__main__":
    unittest.main()
