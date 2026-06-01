from __future__ import annotations

import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

SCRIPTS = Path(__file__).resolve().parents[2] / "hooks" / "scripts"
sys.path.insert(0, str(SCRIPTS))

import stop_reminder  # noqa: E402


class TestStopHookClientArbitrationBlock(unittest.TestCase):
    def test_stop_hook_blocks_client_arbitration_leak(self):
        with tempfile.TemporaryDirectory() as td:
            payload = {
                "cwd": td,
                "assistant_response": "Worktree governance conflict detected. How would you like me to proceed?",
            }
            stdin = io.StringIO(json.dumps(payload))
            stdout = io.StringIO()
            with patch("sys.stdin", stdin), patch("sys.stdout", stdout):
                rc = stop_reminder.main()
            self.assertEqual(rc, 0)
            out = json.loads(stdout.getvalue())
            self.assertEqual(out.get("decision"), "block")
            self.assertIn("client-arbitration", out.get("reason", "").lower())


if __name__ == "__main__":
    unittest.main()
