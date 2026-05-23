"""Tests for C3: session_end_archive.py — AC1-AC4."""
import hashlib
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent.parent.parent / "hooks" / "scripts"))


class TestSessionEndArchive(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.home = tempfile.mkdtemp()
        self.state_root = Path(self.home) / ".copilot" / "hooks" / "state"
        self.state_root.mkdir(parents=True)
        self.cwd = self.tmp
        self.repo_key = hashlib.sha1(self.cwd.encode()).hexdigest()[:16]

    def _make_session_state(self, sid_short: str) -> Path:
        p = self.state_root / f"repo-{self.repo_key}-{sid_short}.json"
        p.write_text(json.dumps({"cwd": self.cwd, "session": sid_short}))
        return p

    def _run_archive(self, session_id: str):
        with patch.dict(os.environ, {"MEGINGJORD_SESSION_ID": session_id}):
            with patch("runtime_paths.state_root", return_value=self.state_root):
                import importlib
                import session_end_archive
                importlib.reload(session_end_archive)
                with patch.object(session_end_archive.Path, "home",
                                  return_value=Path(self.home)):
                    session_end_archive.archive(self.cwd)

    def test_ac1_archives_to_timestamped_file(self):
        """AC1: archives current state to timestamped file in per-session archive dir."""
        self._make_session_state("archive1")
        self._run_archive("archive1-0000-4000-8000-000000000000")
        arc = Path(self.home) / ".megingjord" / "state-archive" / "archive1"
        archived = list(arc.glob(f"repo-{self.repo_key}-end-*.json"))
        self.assertGreater(len(archived), 0, "Should have archived to timestamped file")

    def test_ac2_atomic_write(self):
        """AC2: archive is atomic (no partial/empty file)."""
        self._make_session_state("atomic01")
        self._run_archive("atomic01-0000-4000-8000-000000000000")
        arc = Path(self.home) / ".megingjord" / "state-archive" / "atomic01"
        for f in arc.glob("*.json"):
            data = json.loads(f.read_text())
            self.assertIn("cwd", data)

    def test_ac3_noop_when_no_active_state(self):
        """AC3: no-op when no active session state file exists."""
        self._run_archive("nostate1-0000-4000-8000-000000000000")
        arc = Path(self.home) / ".megingjord" / "state-archive" / "nostate1"
        self.assertFalse(arc.exists())

    def test_ac4_creates_archive_dir(self):
        """AC4: archive dir is created if absent."""
        self._make_session_state("newdir01")
        arc = Path(self.home) / ".megingjord" / "state-archive" / "newdir01"
        self.assertFalse(arc.exists())
        self._run_archive("newdir01-0000-4000-8000-000000000000")
        self.assertTrue(arc.is_dir())

    def test_ac3_noop_when_no_session_id(self):
        """AC3: no-op when no session ID available."""
        env_patch = {k: v for k, v in os.environ.items()
                     if k != "MEGINGJORD_SESSION_ID"}
        with patch.dict(os.environ, env_patch, clear=True):
            with patch("runtime_paths.state_root", return_value=self.state_root):
                import importlib
                import session_end_archive
                importlib.reload(session_end_archive)
                with patch.object(session_end_archive.Path, "home",
                                  return_value=Path(self.home)):
                    session_end_archive.archive(self.cwd)  # Must not raise


if __name__ == "__main__":
    unittest.main()
