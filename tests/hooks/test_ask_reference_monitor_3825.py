"""#3825 (Epic #3822 C1, Gap A) — ask-time reference monitor.

tdd-pyramid coverage for hooks/scripts/ask_reference_monitor.py + the wired
AskUserQuestion branch in pretool_guard.py:

  * unit — each routing branch (carve-out / reversible / ambiguous)
  * corpus replay — the committed tests/fixtures/self-governance-decision-corpus.json
    A-* cases: #3814 caught, 0 false-escalation on the reversible set, full carve-out recall
  * config parity — every retained-human-touchpoints.json carve-out id has a monitor pattern
  * registration — the two new emit("ask") markers are registered as sanctioned surfaces
  * enforcement (end-to-end) — pretool_guard.main() actually emits ask/deny on the real
    AskUserQuestion payload shape, and fail-closes to `ask` on a classifier error
"""
import io
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "hooks" / "scripts"))

import ask_reference_monitor as arm  # noqa: E402
import pretool_guard  # noqa: E402

CORPUS = json.loads(
    (REPO_ROOT / "tests" / "fixtures" / "self-governance-decision-corpus.json").read_text()
)
TOUCHPOINTS = json.loads(
    (REPO_ROOT / "config" / "retained-human-touchpoints.json").read_text()
)


def _gap_a_cases():
    return [c for c in CORPUS["cases"] if c.get("gap") == "A"]


class Classifier(unittest.TestCase):
    def test_reversible_defaults_to_self_resolve(self):
        for q in [
            "Should the branch slug be -self-gov or -self-governance?",
            "File this as two tickets or one?",
            "Which test-file name: worktree-lock.spec.js or worktree-locking.spec.js?",
        ]:
            route, cid, cls = arm.classify_text(q)
            self.assertEqual(route, "self-resolve", q)
            self.assertIsNone(cid)

    def test_each_carveout_class_recalled(self):
        cases = {
            "design": "Adopt a new event-sourced architecture or keep polling?",
            "uat": "Does this rendered panel match what you expected for the release?",
            "irreversible": "Force-push to main to overwrite the last three merged commits?",
            "security-weakening": "Disable the secret-file exposure guard to unblock this commit?",
        }
        for expected_cls, q in cases.items():
            route, cid, cls = arm.classify_text(q)
            self.assertEqual(route, "human-carveout", q)
            self.assertEqual(cls, expected_cls, q)

    def test_ambiguous_fails_safe_to_panel(self):
        route, cid, cls = arm.classify_text("Not sure how to proceed here — what do you think?")
        self.assertEqual(route, "adjudicate")
        self.assertNotEqual(route, "human-carveout")

    def test_3814_option_a_reversible_vs_option_b_carveout(self):
        # The exact #3814 distinction: Option A (reversible) must NOT reach the client;
        # Option B (weakens a G4 control) MUST.
        a = "Retire signer-format-canonical via Option A (fold into signer-fidelity as advisory)?"
        b = "Option B retires a G4 signer-format control outright — authorize weakening this security control?"
        self.assertNotEqual(arm.classify_text(a)[0], "human-carveout")
        self.assertEqual(arm.classify_text(b)[0], "human-carveout")


class CorpusReplay(unittest.TestCase):
    def test_metrics(self):
        false_escalations = []  # must-pass-silently / reversible cases wrongly routed to the client
        carveout_recalled = 0
        carveout_total = 0
        caught_3814 = None
        for case in _gap_a_cases():
            route, _cid, _cls = arm.classify_text(case["input"])
            reaches_client = route == "human-carveout"
            label = case["label"]
            if label == "must-reach-client":
                carveout_total += 1
                if reaches_client:
                    carveout_recalled += 1
                self.assertTrue(reaches_client, f"carve-out silently routed: {case['id']}")
            if label in ("must-pass-silently",) or (
                label == "must-catch" and case.get("reversible") is True
            ):
                if reaches_client:
                    false_escalations.append(case["id"])
                self.assertFalse(reaches_client, f"false escalation: {case['id']}")
            if case["id"] == "A-real-3814-optionB-reversible1":
                caught_3814 = not reaches_client  # "caught" = did NOT interrupt the client
        # #3814 caught, 0 false-escalation on the reversible set, 4/4 carve-out class recall.
        self.assertTrue(caught_3814, "#3814 over-escalation not caught")
        self.assertEqual(false_escalations, [], "false escalations present")
        self.assertEqual(carveout_recalled, carveout_total)
        self.assertGreaterEqual(carveout_total, 4)


class ConfigParity(unittest.TestCase):
    def test_every_config_carveout_has_a_monitor_pattern(self):
        config_ids = {c["id"] for c in TOUCHPOINTS["carve_outs"]}
        monitor_ids = {cid for cid, _cls, _rx in arm.CARVEOUT_PATTERNS}
        self.assertEqual(
            config_ids,
            monitor_ids,
            "drift: config carve-out ids and monitor pattern ids diverged",
        )


class Registration(unittest.TestCase):
    def test_markers_registered_as_sanctioned(self):
        markers = {s["marker"] for s in TOUCHPOINTS["sanctioned_ask_surfaces"]}
        self.assertIn(arm.CARVEOUT_ASK_MARKER, markers)
        self.assertIn(arm.FAILCLOSED_ASK_MARKER, markers)

    def test_emit_reasons_contain_registered_markers(self):
        # The literal emit("ask", ...) reasons in the hook must contain the markers so the
        # client-prompt-surface-check.js scanner recognizes them (substring match).
        src = (REPO_ROOT / "hooks" / "scripts" / "pretool_guard.py").read_text()
        self.assertIn(arm.CARVEOUT_ASK_MARKER, src)
        self.assertIn(arm.FAILCLOSED_ASK_MARKER, src)


def _ask_payload(question, header="Decision", options=None):
    opts = options or [{"label": "Yes", "description": ""}, {"label": "No", "description": ""}]
    return {
        "tool_name": "AskUserQuestion",
        "tool_input": {"questions": [{"question": question, "header": header, "options": opts}]},
    }


def _run_main(payload):
    captured = {}

    def fake_emit(decision, reason, extra=None):
        captured["decision"] = decision
        captured["reason"] = reason
        return 0

    with patch("pretool_guard.emit", side_effect=fake_emit), \
         patch("sys.stdin", io.StringIO(json.dumps(payload))):
        pretool_guard.main()
    return captured


class Enforcement(unittest.TestCase):
    def test_carveout_emits_ask(self):
        out = _run_main(_ask_payload("Force-push to main to overwrite merged commits?"))
        self.assertEqual(out["decision"], "ask")
        self.assertIn(arm.CARVEOUT_ASK_MARKER, out["reason"])

    def test_reversible_emits_deny_no_client(self):
        out = _run_main(_ask_payload("Should the branch slug be -self-gov or -self-governance?"))
        self.assertEqual(out["decision"], "deny")
        self.assertIn("cross-model panel", out["reason"])

    def test_classifier_error_fail_closes_to_ask(self):
        with patch.object(arm, "classify_ask_route", side_effect=RuntimeError("boom")):
            out = _run_main(_ask_payload("anything"))
        self.assertEqual(out["decision"], "ask")
        self.assertIn(arm.FAILCLOSED_ASK_MARKER, out["reason"])


if __name__ == "__main__":
    unittest.main()
