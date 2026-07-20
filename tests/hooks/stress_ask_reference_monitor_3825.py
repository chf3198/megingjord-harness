"""#3825 stress — ask-time reference monitor (Gap A).

Adversarial fault-injection (G6) + a p99 latency budget (G7) for the in-process
classifier, per the test-methodology matrix (adversarial-input parser + side-effect-
bearing gate => stress-test alongside the primary tdd-pyramid strategy). The classifier
runs INSIDE the pretool_guard hook on every AskUserQuestion, so it must (a) never raise
on malformed input and (b) stay well within the <=~50 ms inline budget.

Exotic fuzz chars are written as escape sequences only (no literal non-ASCII / NUL in
source) per the stress-spec authoring rule.
"""
import sys
import time
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "hooks" / "scripts"))

import ask_reference_monitor as arm  # noqa: E402

# Malformed / adversarial payloads that must NEVER raise (the hook is fail-safe).
FAULT_PAYLOADS = [
    None,
    {},
    {"questions": None},
    {"questions": "not-a-list"},
    {"questions": [None, 123, {"question": None}, {"options": "x"}]},
    {"questions": [{"question": "x" * 200000, "options": [{"label": None}]}]},
    {"questions": [{"question": "\x00�\U0001f4a5 emoji + nul", "header": "‮"}]},
    {"nested": {"deep": [{"x": [{"y": "force-push to main"}]}]}},
    [{"weird": "list-not-dict"}],
    "a raw string payload",
    12345,
    {"questions": [{"options": [{"label": "disable the gate", "description": None}]}]},
]

# Adversarial classification inputs -- exotic chars (as escapes), injection-flavored, empty.
FAULT_TEXTS = [
    "",
    None,
    "\n\t\r   ",
    "'; DROP TABLE gates; --",
    "disable" * 5000,
    " ​‮ reversed",
    "force-push" + "\U0001f680" * 1000,
]


class FaultInjection(unittest.TestCase):
    def test_extract_never_raises(self):
        for p in FAULT_PAYLOADS:
            try:
                arm.extract_ask_text(p)
                arm.classify_ask_route(p)
            except Exception as exc:  # noqa: BLE001
                self.fail(f"classify_ask_route raised on {type(p).__name__}: {exc}")

    def test_classify_text_never_raises_and_returns_valid_route(self):
        valid = {"human-carveout", "self-resolve", "adjudicate"}
        for t in FAULT_TEXTS:
            route, _cid, _cls = arm.classify_text(t)
            self.assertIn(route, valid, repr(t))

    def test_telemetry_never_raises(self):
        # Metadata-only telemetry is best-effort; a bad path/text must not throw.
        arm.emit_ask_redirect_telemetry("self-resolve", None, None)
        arm.emit_ask_redirect_telemetry("adjudicate", "x", "some text")


class LatencyBudget(unittest.TestCase):
    def test_p99_inline_classify_under_budget(self):
        # Representative mixed workload: corpus-like carve-outs + reversible + adversarial.
        samples = [
            {"questions": [{"question": "Force-push to main to overwrite commits?",
                            "header": "h", "options": [{"label": "Yes"}]}]},
            {"questions": [{"question": "Should the branch slug be -a or -b?",
                            "header": "h", "options": [{"label": "a"}, {"label": "b"}]}]},
            {"questions": [{"question": "Disable the exposure guard to unblock?",
                            "header": "h", "options": [{"label": "ok"}]}]},
            {"questions": [{"question": "x" * 4000, "header": "h", "options": []}]},
        ]
        durations = []
        iterations = 3000
        for i in range(iterations):
            payload = samples[i % len(samples)]
            start = time.perf_counter()
            arm.classify_ask_route(payload)
            durations.append((time.perf_counter() - start) * 1000.0)
        durations.sort()
        p99 = durations[int(len(durations) * 0.99)]
        # <=~50 ms inline budget (D2). In-process regex is microseconds; assert with margin.
        self.assertLess(p99, 50.0, f"p99 {p99:.3f} ms exceeds the 50 ms inline budget")


if __name__ == "__main__":
    unittest.main()
