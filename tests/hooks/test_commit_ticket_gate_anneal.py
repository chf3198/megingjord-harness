"""A3 (Epic #3576 W-A) — anneal-lane incident-ref carve-out for commit_ticket_gate.

The rolling `anneal/<ISO-week>` branch accepts an `incident:<pattern_id>` reference
in lieu of a `#N` ticket ref — linkage is still REQUIRED, just incident-typed.
Ticket-branch behavior is unchanged (regression cases).

Run: python3 -m unittest tests/hooks/test_commit_ticket_gate_anneal.py
"""
import io
import json
import sys
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "hooks" / "scripts"))

import commit_ticket_gate as gate  # noqa: E402


def run(branch, commit_cmd, tool="Bash"):
    """Drive the hook; return the parsed decision dict (or None when it passes)."""
    payload = {"tool_name": tool, "cwd": "/repo", "tool_input": {"command": commit_cmd}}
    buf = io.StringIO()
    with patch.object(gate, "is_repo_enabled", return_value=True), \
            patch.object(gate, "get_current_branch", return_value=branch), \
            patch.object(gate, "ensure_state", return_value={}), \
            patch.object(gate, "save_state", return_value=None), \
            patch.object(sys, "stdin", io.StringIO(json.dumps(payload))), \
            redirect_stdout(buf):
        rc = gate.main()
    out = buf.getvalue().strip()
    dec = json.loads(out)["hookSpecificOutput"] if out else None
    return rc, dec


class AnnealCarveOut(unittest.TestCase):
    def test_anneal_with_incident_ref_allows(self):
        rc, dec = run("anneal/2026-W31",
                      'git commit -m "chore(anneal): retune (incident:raw-fleet-curl-bypasses-hamr)"')
        self.assertEqual(rc, 0)
        self.assertIsNone(dec)  # passes silently

    def test_anneal_with_ticket_ref_allows(self):
        rc, dec = run("anneal/2026-W31", 'git commit -m "chore(anneal): fold in fix (#3576)"')
        self.assertIsNone(dec)

    def test_anneal_without_any_linkage_denies(self):
        rc, dec = run("anneal/2026-W31", 'git commit -m "chore(anneal): tweak thresholds"')
        self.assertIsNotNone(dec)
        self.assertEqual(dec["permissionDecision"], "deny")
        self.assertIn("incident:", dec["permissionDecisionReason"])

    def test_anneal_wrong_week_format_falls_through_to_ticket_rules(self):
        # 'anneal/latest' is NOT the ISO-week lane -> treated as a normal (ticketless) branch -> passes.
        rc, dec = run("anneal/latest", 'git commit -m "chore: x"')
        self.assertIsNone(dec)


class TicketBranchRegression(unittest.TestCase):
    def test_ticket_branch_matching_ref_allows(self):
        rc, dec = run("3580-operative-ruleset-adr", 'git commit -m "feat: x (#3580)"')
        self.assertIsNone(dec)

    def test_ticket_branch_missing_ref_denies(self):
        rc, dec = run("3580-operative-ruleset-adr", 'git commit -m "feat: x"')
        self.assertEqual(dec["permissionDecision"], "deny")

    def test_ticket_branch_mismatched_ref_denies(self):
        rc, dec = run("3580-operative-ruleset-adr", 'git commit -m "feat: x (#9999)"')
        self.assertEqual(dec["permissionDecision"], "deny")
        self.assertIn("mismatch", dec["permissionDecisionReason"].lower())

    def test_non_commit_command_passes(self):
        rc, dec = run("anneal/2026-W31", "git status")
        self.assertIsNone(dec)


if __name__ == "__main__":
    unittest.main()
